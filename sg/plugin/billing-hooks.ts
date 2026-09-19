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

type BillingIdentity = { globalId: string; role: "monarch" | "citizen" };
type ModelRates = { input: number; output: number; cacheRead: number; cacheWrite: number };

function automationJobId(ctx: { jobId?: string; sessionKey?: string }): string | undefined {
  const explicit = ctx.jobId?.trim();
  if (explicit) {
    return explicit;
  }
  return /^agent:[^:]+:cron:([^:]+):run:[^:]+$/u.exec(ctx.sessionKey ?? "")?.[1];
}

function modelRates(value: ModelRates): ModelRates | undefined {
  const rates = [value.input, value.output, value.cacheRead, value.cacheWrite];
  return rates.every((rate) => Number.isFinite(rate) && rate >= 0) && rates.some((rate) => rate > 0)
    ? { ...value }
    : undefined;
}

function estimatedModelCostUsd(
  usage:
    | {
        input?: number;
        output?: number;
        cacheRead?: number;
        cacheWrite?: number;
      }
    | undefined,
  rates: ModelRates | undefined,
): number | undefined {
  if (!usage || !rates) {
    return undefined;
  }
  const tokens = [usage.input, usage.output, usage.cacheRead, usage.cacheWrite];
  if (
    !tokens.some((value) => value !== undefined) ||
    tokens.some((value) => value !== undefined && (!Number.isFinite(value) || value < 0))
  ) {
    return undefined;
  }
  return (
    ((usage.input ?? 0) * rates.input +
      (usage.output ?? 0) * rates.output +
      (usage.cacheRead ?? 0) * rates.cacheRead +
      (usage.cacheWrite ?? 0) * rates.cacheWrite) /
    1_000_000
  );
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function automationResultJobId(result: unknown): string | undefined {
  const details = record(record(result)?.details);
  const job = record(details?.job);
  for (const value of [details?.id, details?.jobId, job?.id]) {
    if ((typeof value === "string" || typeof value === "number") && String(value).trim()) {
      return String(value).trim();
    }
  }
  return undefined;
}

function automationResultSucceeded(result: unknown, error: string | undefined): boolean {
  if (error) {
    return false;
  }
  const details = record(record(result)?.details);
  if (!details) {
    return true;
  }
  if (details.ok === false || details.success === false) {
    return false;
  }
  const status = typeof details.status === "string" ? details.status.toLowerCase() : "";
  return !["error", "failed", "denied"].includes(status);
}

function automationParamJobId(params: Record<string, unknown>): string | undefined {
  for (const value of [params.jobId, params.id]) {
    if ((typeof value === "string" || typeof value === "number") && String(value).trim()) {
      return String(value).trim();
    }
  }
  return undefined;
}

export function registerSgBillingHooks(params: { api: SgBillingHookApi; stateDir: string }): void {
  const { api, stateDir } = params;
  const ledger = new SgBillingLedger(stateDir);
  const profiles = new SgGlobalProfileRegistry(stateDir);
  const pendingAutomationOwners = new Map<
    string,
    { action: "add" | "update" | "remove"; identity: BillingIdentity; jobId?: string }
  >();
  const pendingModelRates = new Map<
    string,
    { provider: string; model: string; rates: ModelRates }
  >();
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
    const jobId = automationJobId(ctx);
    const profile = await resolveProfile(
      ctx.channel ?? ctx.messageProvider,
      event.senderId ?? ctx.senderId,
    );
    const storedAutomationOwner =
      !profile && jobId ? await ledger.resolveAutomationOwner(jobId) : undefined;
    const automationProfile = storedAutomationOwner
      ? await profiles.findByGlobalId(storedAutomationOwner.globalId)
      : undefined;
    const automationOwner =
      automationProfile?.role === storedAutomationOwner?.role ? storedAutomationOwner : undefined;
    const identity: BillingIdentity | undefined =
      profile?.role === "monarch" || profile?.role === "citizen"
        ? { globalId: profile.globalId, role: profile.role }
        : automationOwner;
    // OpenClaw resolves this bit from trusted ingress identity before plugin hooks run.
    // Preserve owner availability if the secondary SG profile store itself is unavailable;
    // there is no safe Global ID to which cost can be attributed in that degraded case.
    if (!identity && event.senderIsOwner === true) {
      return { outcome: "pass" };
    }
    if (!identity) {
      const automationUnbound = Boolean(jobId);
      return {
        outcome: "block",
        reason: automationUnbound
          ? "SG automation has no active trusted billing owner"
          : "SG cannot prove the payer Global ID",
        message: automationUnbound
          ? "Задача не привязана к активному владельцу биллинга. Выполнение остановлено."
          : "Недостаточно средств. Сначала пополните баланс.",
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
      if (identity.role === "monarch") {
        await ledger.startTrackedOperation({
          globalId: identity.globalId,
          operationId,
          role: "monarch",
        });
      } else {
        await ledger.reserveAvailable({ globalId: identity.globalId, operationId });
      }
      await ledger.bindCorrelation({
        correlationId: `run:${runId}`,
        globalId: identity.globalId,
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
    const providerBilledCost =
      providerCost?.totalOrigin === "provider-billed" &&
      providerCost.total !== undefined &&
      Number.isFinite(providerCost.total) &&
      providerCost.total >= 0
        ? providerCost.total
        : undefined;
    const pricingKey = `${event.runId}\0${event.callId}`;
    const pricing = pendingModelRates.get(pricingKey);
    pendingModelRates.delete(pricingKey);
    const actualCost =
      providerBilledCost ??
      (pricing?.provider === event.provider && pricing.model === event.model
        ? estimatedModelCostUsd(event.usage, pricing.rates)
        : undefined);
    try {
      await ledger.recordPart({
        ...correlation,
        partId: `model:${event.callId}`,
        outcome: event.outcome,
        ...(actualCost === undefined ? {} : { actualCostNanoUsd: usdToNanoUsd(actualCost) }),
      });
      if (actualCost === undefined) {
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
      const rates = modelRates(event.cost);
      if (!rates) {
        return { block: true, blockReason: "SG model pricing is unavailable" };
      }
      const billing = await ledger.operationBilling(correlation);
      if (billing.chargeMultiplier === 0) {
        pendingModelRates.set(`${event.runId}\0${event.callId}`, {
          provider: event.provider,
          model: event.model,
          rates,
        });
        return;
      }
      const capacity = await ledger.prepaidCapacity(correlation);
      if (capacity.hasUnpricedParts) {
        return {
          block: true,
          blockReason: "SG cannot authorize new spend while prior provider cost is unknown",
        };
      }
      const inputRate = Math.max(rates.input, rates.cacheRead, rates.cacheWrite, rates.input * 2);
      const outputRate = rates.output;
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
      pendingModelRates.set(`${event.runId}\0${event.callId}`, {
        provider: event.provider,
        model: event.model,
        rates,
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
    if (event.toolName === "automations" || event.toolName === "cron") {
      const action = event.params.action;
      const requester = ctx.requester;
      const profile = await resolveProfile(requester?.channel, requester?.senderId);
      if (
        (action === "add" || action === "update" || action === "remove") &&
        (profile?.role === "monarch" || profile?.role === "citizen") &&
        event.toolCallId
      ) {
        pendingAutomationOwners.set(event.toolCallId, {
          action,
          identity: { globalId: profile.globalId, role: profile.role },
          ...((action === "update" || action === "remove") && automationParamJobId(event.params)
            ? { jobId: automationParamJobId(event.params) }
            : {}),
        });
      }
    }
    if (!PAID_MEDIA_TOOL_NAMES.has(event.toolName)) {
      return;
    }
    const requester = ctx.requester;
    const profile = await resolveProfile(requester?.channel, requester?.senderId);
    if ((profile?.role !== "monarch" && profile?.role !== "citizen") || !event.toolCallId) {
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
        if (profile.role === "monarch") {
          await ledger.startTrackedOperation({
            globalId: profile.globalId,
            operationId,
            role: "monarch",
          });
        } else {
          await ledger.reserveAvailable({ globalId: profile.globalId, operationId });
        }
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

  api.on("after_tool_call", async (event) => {
    if (!event.toolCallId) {
      return;
    }
    const pending = pendingAutomationOwners.get(event.toolCallId);
    if (!pending) {
      return;
    }
    pendingAutomationOwners.delete(event.toolCallId);
    if (!automationResultSucceeded(event.result, event.error)) {
      return;
    }
    const jobId = pending.action === "add" ? automationResultJobId(event.result) : pending.jobId;
    if (!jobId) {
      api.logger?.warn("[sg-billing] automation ownership result has no job id");
      return;
    }
    try {
      if (pending.action === "remove") {
        await ledger.unbindAutomationOwner(jobId);
        return;
      }
      await ledger.bindAutomationOwner({ jobId, ...pending.identity });
    } catch (error) {
      api.logger?.warn(
        `[sg-billing] automation ownership binding failed safely: ${error instanceof Error ? error.message : String(error)}`,
      );
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
      return;
    }
    try {
      const billing = await ledger.operationBilling(correlation);
      if (billing.chargeMultiplier === 0) {
        return { block: false };
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
    pendingModelRates.clear();
    ledger.close();
  });
}
