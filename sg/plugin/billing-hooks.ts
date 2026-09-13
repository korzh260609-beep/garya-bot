import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { SgBillingLedger, usdToNanoUsd } from "./billing-ledger.js";
import { resolveSgCanonicalIdentity } from "./context.js";
import { SgGlobalProfileRegistry } from "./global-profile-registry.js";

type SgBillingHookApi = {
  config?: OpenClawPluginApi["config"];
  on: OpenClawPluginApi["on"];
  logger?: { warn(message: string): void };
};

const PAID_MEDIA_TOOL_NAMES = new Set(["image_generate", "video_generate", "music_generate"]);
const NANO_USD_PER_TOKEN_PER_MILLION_RATE = 1_000;
const CUSTOMER_PRICE_MULTIPLIER = 2;

export function registerSgBillingHooks(params: { api: SgBillingHookApi; stateDir: string }): void {
  const { api, stateDir } = params;
  const ledger = new SgBillingLedger(stateDir);
  const profiles = new SgGlobalProfileRegistry(stateDir);
  const resolveProfile = async (channel?: string, senderId?: string) => {
    if (!channel || !senderId) {
      return undefined;
    }
    const canonicalIdentity = resolveSgCanonicalIdentity({
      channel,
      senderId,
      identityLinks: api.config?.session?.identityLinks,
    });
    return canonicalIdentity ? profiles.findByCanonicalIdentity(canonicalIdentity) : undefined;
  };

  api.on("before_agent_run", async (event, ctx) => {
    const profile = await resolveProfile(
      event.channelId ?? ctx.channel ?? ctx.messageProvider,
      event.senderId ?? ctx.senderId,
    );
    if (profile?.role === "monarch") {
      return { outcome: "pass" };
    }
    if (profile?.role !== "citizen") {
      return {
        outcome: "block",
        reason: "SG cannot prove the payer Global ID",
        message: "Не удалось определить плательщика. Запрос остановлен до списания OpenAI.",
        category: "cost_identity_unresolved",
      };
    }
    const runId = ctx.runId;
    if (!runId) {
      return {
        outcome: "block",
        reason: "SG cannot correlate the run with billing",
        message: "Не удалось связать запрос со счётом. Запрос остановлен.",
        category: "cost_identity_unresolved",
      };
    }
    const operationId = `run:${runId}`;
    try {
      await ledger.reserveAvailable({ globalId: profile.globalId, operationId });
      await ledger.bindCorrelation({
        correlationId: `run:${runId}`,
        globalId: profile.globalId,
        operationId,
      });
      return { outcome: "pass" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "sg-billing-insufficient-funds") {
        return {
          outcome: "block",
          reason: "SG prepaid balance is insufficient",
          message: "Недостаточно средств. Сначала пополните баланс.",
          category: "cost_limit",
        };
      }
      api.logger?.warn(`[sg-billing] reserve failed safely: ${message}`);
      return {
        outcome: "block",
        reason: "SG billing ledger is unavailable",
        message: "Биллинг временно недоступен. Запрос остановлен без расходов OpenAI.",
        category: "cost_limit",
      };
    }
  });

  api.on("model_call_ended", async (event) => {
    const correlation = await ledger.resolveCorrelation(`run:${event.runId}`);
    if (!correlation) {
      api.logger?.warn(`[sg-billing] model call has no run correlation: ${event.callId}`);
      return;
    }
    const providerCost = event.usage?.cost;
    const exactCost =
      providerCost?.totalOrigin === "provider-billed" && providerCost.total !== undefined
        ? providerCost.total
        : undefined;
    try {
      await ledger.recordPart({
        ...correlation,
        partId: `model:${event.callId}`,
        outcome: event.outcome,
        ...(exactCost === undefined ? {} : { actualCostNanoUsd: usdToNanoUsd(exactCost) }),
      });
      if (exactCost === undefined) {
        api.logger?.warn(
          `[sg-billing] provider cost unavailable; reserve retained for model call ${event.callId}`,
        );
      }
    } catch (error) {
      api.logger?.warn(
        `[sg-billing] model settlement failed safely; reserve retained: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  api.on("before_model_call", async (event) => {
    const correlation = await ledger.resolveCorrelation(`run:${event.runId}`);
    if (!correlation) {
      return;
    }
    try {
      const capacity = await ledger.prepaidCapacity(correlation);
      if (capacity.hasUnpricedParts) {
        return {
          block: true,
          blockReason: "SG cannot authorize new spend while prior provider cost is unknown",
        };
      }
      const inputRate = Math.max(
        event.cost.input,
        event.cost.cacheRead,
        event.cost.cacheWrite,
        event.cost.input * 2,
      );
      const outputRate = event.cost.output;
      if (
        !Number.isFinite(inputRate) ||
        inputRate < 0 ||
        !Number.isFinite(outputRate) ||
        outputRate < 0 ||
        (inputRate === 0 && outputRate === 0)
      ) {
        return { block: true, blockReason: "SG model pricing is unavailable" };
      }
      const providerBudgetNanoUsd = Math.floor(
        capacity.remainingNanoUsd / CUSTOMER_PRICE_MULTIPLIER,
      );
      const inputUpperBoundNanoUsd = Math.ceil(
        event.inputUpperBoundTokens * inputRate * NANO_USD_PER_TOKEN_PER_MILLION_RATE,
      );
      const outputBudgetNanoUsd = providerBudgetNanoUsd - inputUpperBoundNanoUsd;
      const maxOutputTokens =
        outputRate === 0
          ? event.maxOutputTokens
          : Math.min(
              event.maxOutputTokens,
              Math.floor(outputBudgetNanoUsd / (outputRate * NANO_USD_PER_TOKEN_PER_MILLION_RATE)),
            );
      if (maxOutputTokens < 1) {
        return { block: true, blockReason: "SG prepaid balance cannot cover this model request" };
      }
      const providerAuthorizedNanoUsd =
        inputUpperBoundNanoUsd +
        Math.ceil(maxOutputTokens * outputRate * NANO_USD_PER_TOKEN_PER_MILLION_RATE);
      await ledger.authorizePart({
        ...correlation,
        partId: `model:${event.callId}`,
        authorizedNanoUsd: providerAuthorizedNanoUsd * CUSTOMER_PRICE_MULTIPLIER,
      });
      return { maxOutputTokens, maxRetries: 0 };
    } catch (error) {
      api.logger?.warn(
        `[sg-billing] model authorization failed safely: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { block: true, blockReason: "SG prepaid billing could not authorize this model call" };
    }
  });

  api.on("before_tool_call", async (event, ctx) => {
    if (!PAID_MEDIA_TOOL_NAMES.has(event.toolName)) {
      return;
    }
    const requester = ctx.requester;
    const profile = await resolveProfile(requester?.channel, requester?.senderId);
    if (profile?.role === "monarch") {
      return;
    }
    if (profile?.role !== "citizen" || !event.toolCallId) {
      return {
        block: true,
        blockReason: "SG cannot prove the payer or paid-operation correlation",
      };
    }
    try {
      const runId = event.runId ?? ctx.runId;
      let correlation = runId ? await ledger.resolveCorrelation(`run:${runId}`) : undefined;
      if (!correlation) {
        const operationId = `tool:${event.toolCallId}`;
        await ledger.reserveAvailable({ globalId: profile.globalId, operationId });
        correlation = { globalId: profile.globalId, operationId };
        if (runId) {
          await ledger.bindCorrelation({ correlationId: `run:${runId}`, ...correlation });
        }
      }
      await ledger.bindCorrelation({
        correlationId: `tool:${event.toolCallId}`,
        ...correlation,
      });
      await ledger.recordUnpricedPart({
        ...correlation,
        partId: `tool:${event.toolCallId}`,
      });
    } catch (error) {
      api.logger?.warn(
        `[sg-billing] paid tool reserve failed safely: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { block: true, blockReason: "SG prepaid billing could not reserve this operation" };
    }
  });

  api.on("before_billable_operation", async (event) => {
    if (!event.toolCallId) {
      return {
        block: true,
        blockReason: "SG cannot prove the paid-operation correlation",
      };
    }
    const correlation = await ledger.resolveCorrelation(`tool:${event.toolCallId}`);
    if (!correlation) {
      // Monarch operations never create a citizen reservation and remain unrestricted.
      return;
    }
    const upperBound = event.costUpperBound;
    if (
      upperBound?.evidence !== "catalog-upper-bound" ||
      !Number.isFinite(upperBound.totalUsd) ||
      upperBound.totalUsd <= 0
    ) {
      return {
        block: true,
        blockReason: "SG cannot prove this provider's maximum media cost",
      };
    }
    try {
      const providerUpperBoundNanoUsd = usdToNanoUsd(upperBound.totalUsd);
      await ledger.authorizePart({
        ...correlation,
        partId: `tool:${event.toolCallId}`,
        authorizedNanoUsd: providerUpperBoundNanoUsd * CUSTOMER_PRICE_MULTIPLIER,
      });
      return { block: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      api.logger?.warn(`[sg-billing] paid operation authorization failed safely: ${message}`);
      return {
        block: true,
        blockReason:
          message === "sg-billing-insufficient-prepaid-capacity"
            ? "SG prepaid balance cannot cover this media request"
            : "SG prepaid billing could not authorize this media request",
      };
    }
  });

  api.on("billable_operation_completed", async (event) => {
    if (!event.toolCallId) {
      api.logger?.warn("[sg-billing] paid operation has no tool correlation; reserve retained");
      return;
    }
    const correlation = await ledger.resolveCorrelation(`tool:${event.toolCallId}`);
    if (!correlation) {
      api.logger?.warn(
        `[sg-billing] paid operation has no reservation: ${event.toolCallId}; settlement skipped`,
      );
      return;
    }
    const exactCostUsd =
      event.cost?.evidence === "provider-billed" || event.cost?.evidence === "reconciled"
        ? event.cost.totalUsd
        : undefined;
    try {
      await ledger.recordPart({
        ...correlation,
        partId: `tool:${event.toolCallId}`,
        outcome: event.outcome,
        ...(exactCostUsd === undefined ? {} : { actualCostNanoUsd: usdToNanoUsd(exactCostUsd) }),
      });
      if (exactCostUsd === undefined) {
        api.logger?.warn(
          `[sg-billing] provider cost unavailable; reserve retained for paid operation ${event.toolCallId}`,
        );
      }
    } catch (error) {
      api.logger?.warn(
        `[sg-billing] paid operation settlement failed safely; reserve retained: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  api.on("agent_end", async (event, ctx) => {
    const runId = event.runId ?? ctx.runId;
    if (!runId) {
      return;
    }
    const correlation = await ledger.resolveCorrelation(`run:${runId}`);
    if (!correlation) {
      return;
    }
    try {
      const finalized = await ledger.finalizeParts({
        ...correlation,
        outcome: event.success ? "completed" : "error",
      });
      if (!finalized) {
        api.logger?.warn(`[sg-billing] unpriced provider work; reserve retained for run ${runId}`);
      }
    } catch (error) {
      api.logger?.warn(
        `[sg-billing] run finalization failed safely; reserve retained: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  api.on("gateway_stop", () => {
    ledger.close();
  });
}
