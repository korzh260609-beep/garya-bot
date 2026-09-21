import { createHash } from "node:crypto";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { SgBillingLedger, type SgBillingOperationSource, usdToNanoUsd } from "./billing-ledger.js";
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
type BillingOwner = BillingIdentity & { source: SgBillingOperationSource };
type ModelRates = { input: number; output: number; cacheRead: number; cacheWrite: number };

function automationJobId(ctx: { jobId?: string; sessionKey?: string }): string | undefined {
  const explicit = ctx.jobId?.trim();
  if (explicit) {
    return explicit;
  }
  return /^agent:[^:]+:cron:([^:]+):run:[^:]+$/u.exec(ctx.sessionKey ?? "")?.[1];
}

function openClawDelegationSessionId(params: {
  requestedSessionId?: unknown;
  agentId?: string;
  sessionKey?: string;
}): string | undefined {
  const requested =
    typeof params.requestedSessionId === "string" ? params.requestedSessionId.trim() : "";
  if (requested) {
    return requested;
  }
  const sessionKey = params.sessionKey?.trim();
  if (!sessionKey) {
    return undefined;
  }
  // This mirrors OpenClaw's host-owned default delegation id. A mismatch must fail closed,
  // otherwise the nested system-agent run loses its payer while the provider call still starts.
  return `delegate-${createHash("sha256")
    .update(`${params.agentId?.trim() || "unknown"}\0${sessionKey}`)
    .digest("hex")
    .slice(0, 32)}`;
}

function delegatedSessionOwnerKey(sessionId: string): string {
  return `openclaw-delegation:${sessionId}`;
}

function compactionParentRunId(runId: string): string | undefined {
  const marker = ":compaction:";
  const markerIndex = runId.lastIndexOf(marker);
  if (markerIndex <= 0 || markerIndex + marker.length >= runId.length) {
    return undefined;
  }
  // Direct compaction emits model hooks under a derived run id without its own run admission.
  // Preserve the parent's reservation so compaction cannot become uncorrelated paid work.
  return runId.slice(0, markerIndex);
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
  const activeOwner = async <T extends BillingOwner>(owner: T | undefined) => {
    if (!owner) {
      return undefined;
    }
    const profile = await profiles.findByGlobalId(owner.globalId);
    return profile?.role === owner.role ? owner : undefined;
  };
  const resolveActiveMonarch = async (): Promise<BillingOwner | undefined> => {
    const snapshot = await profiles.snapshot();
    const monarch = snapshot.profiles.find(
      (profile) =>
        profile.globalId === snapshot.monarchGlobalId &&
        profile.role === "monarch" &&
        profile.status === "active",
    );
    return monarch
      ? { globalId: monarch.globalId, role: "monarch", source: { kind: "request" } }
      : undefined;
  };
  const resolveSessionOwner = async (
    sessionKey?: string,
    sessionId?: string,
    allowDelegatedSessionId = false,
  ) => {
    const normalizedSessionKey = sessionKey?.trim();
    const normalizedSessionId = sessionId?.trim();
    if (!normalizedSessionKey && !normalizedSessionId) {
      return undefined;
    }
    try {
      if (allowDelegatedSessionId && normalizedSessionId) {
        const delegatedOwner = await activeOwner(
          await ledger.resolveSessionOwner(delegatedSessionOwnerKey(normalizedSessionId)),
        );
        if (delegatedOwner) {
          return delegatedOwner;
        }
      }
      if (!normalizedSessionKey) {
        return undefined;
      }
      const [{ resolveAgentIdFromSessionKey }, { getSessionEntry }] = await Promise.all([
        import("openclaw/plugin-sdk/session-key-runtime"),
        import("openclaw/plugin-sdk/session-store-runtime"),
      ]);
      const visited = new Set<string>();
      let currentSessionKey: string | undefined = normalizedSessionKey;
      for (let depth = 0; currentSessionKey && depth < 16; depth += 1) {
        if (visited.has(currentSessionKey)) {
          return undefined;
        }
        visited.add(currentSessionKey);
        const currentOwner = await activeOwner(await ledger.resolveSessionOwner(currentSessionKey));
        if (currentOwner) {
          return currentOwner;
        }
        const entry = getSessionEntry({
          agentId: resolveAgentIdFromSessionKey(currentSessionKey),
          env: { ...process.env, OPENCLAW_STATE_DIR: stateDir },
          readConsistency: "latest",
          sessionKey: currentSessionKey,
        });
        currentSessionKey = entry?.parentSessionKey?.trim() || entry?.spawnedBy?.trim();
      }
      return undefined;
    } catch (error) {
      api.logger?.warn(
        `[sg-billing] session owner lookup failed safely: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  };

  const resolveRunCorrelation = async (runId: string) => {
    const direct = await ledger.resolveCorrelation(`run:${runId}`);
    if (direct) {
      return direct;
    }
    const parentRunId = compactionParentRunId(runId);
    return parentRunId ? ledger.resolveCorrelation(`run:${parentRunId}`) : undefined;
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
    const directOwner: BillingOwner | undefined =
      profile?.role === "monarch" || profile?.role === "citizen"
        ? {
            globalId: profile.globalId,
            role: profile.role,
            source: jobId ? { kind: "automation", id: jobId } : { kind: "request" },
          }
        : undefined;
    let owner: BillingOwner | undefined =
      directOwner ??
      (automationOwner && jobId
        ? { ...automationOwner, source: { kind: "automation", id: jobId } }
        : await resolveSessionOwner(
            ctx.sessionKey,
            ctx.sessionId,
            ctx.channel === "openclaw" || ctx.messageProvider === "openclaw",
          ));
    const trustedSystemRun =
      !owner &&
      ctx.trigger === "manual" &&
      (ctx.channel === "openclaw" || ctx.messageProvider === "openclaw") &&
      (ctx.runId?.startsWith("openclaw-planner-") ||
        ctx.runId?.startsWith("openclaw-greeting-") ||
        ctx.runId?.startsWith("probe-setup-inference-"));
    if (trustedSystemRun) {
      owner = await resolveActiveMonarch();
    }
    // OpenClaw resolves this bit from trusted ingress identity before plugin hooks run.
    // Preserve owner availability if the secondary SG profile store itself is unavailable;
    // there is no safe Global ID to which cost can be attributed in that degraded case.
    if (!owner && event.senderIsOwner === true) {
      return { outcome: "pass" };
    }
    if (!owner) {
      const automationUnbound = Boolean(jobId);
      return {
        outcome: "block",
        reason: automationUnbound
          ? "SG automation has no active trusted billing owner"
          : "SG cannot prove the payer Global ID",
        message: automationUnbound
          ? "Задача не привязана к активному владельцу биллинга. Выполнение остановлено."
          : "Не удалось подтвердить владельца запроса. Выполнение остановлено без расходов.",
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
    const source = owner.source;
    try {
      if (owner.role === "monarch") {
        await ledger.startTrackedOperation({
          globalId: owner.globalId,
          operationId,
          role: "monarch",
          source,
        });
      } else {
        await ledger.reserveAvailable({ globalId: owner.globalId, operationId, source });
      }
      const sharedSystemAgentSession =
        ctx.agentId === "openclaw" &&
        ctx.trigger === "manual" &&
        (ctx.channel === "openclaw" || ctx.messageProvider === "openclaw");
      // The system agent reuses agent:openclaw:main across callers. Persisting that shared key
      // would let a later unbound control turn inherit an earlier caller's billing owner.
      if (ctx.sessionKey && !sharedSystemAgentSession) {
        await ledger.bindSessionOwner({ sessionKey: ctx.sessionKey, ...owner });
      }
      await ledger.bindCorrelation({
        correlationId: `run:${runId}`,
        globalId: owner.globalId,
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
    const correlation = await resolveRunCorrelation(event.runId);
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
      (pricing && pricing.provider === event.provider && pricing.model === event.model
        ? estimatedModelCostUsd(event.usage, pricing.rates)
        : undefined);
    try {
      await ledger.recordPart({
        ...correlation,
        partId: `model:${event.callId}`,
        outcome: event.outcome,
        ...(actualCost === undefined ? {} : { actualCostNanoUsd: usdToNanoUsd(actualCost) }),
        metadata: {
          kind: "model",
          provider: event.provider,
          model: event.model,
          ...(event.usage?.input === undefined ? {} : { inputTokens: event.usage.input }),
          ...(event.usage?.output === undefined ? {} : { outputTokens: event.usage.output }),
          ...(event.usage?.cacheRead === undefined
            ? {}
            : { cacheReadTokens: event.usage.cacheRead }),
          ...(event.usage?.cacheWrite === undefined
            ? {}
            : { cacheWriteTokens: event.usage.cacheWrite }),
          ...(actualCost === undefined
            ? {}
            : {
                costEvidence:
                  providerBilledCost === undefined
                    ? ("catalog-estimate" as const)
                    : ("provider-billed" as const),
              }),
        },
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
    const correlation = await resolveRunCorrelation(event.runId);
    if (!correlation) {
      return { block: true, blockReason: "SG cannot prove the payer or model-run correlation" };
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
        metadata: { kind: "model", provider: event.provider, model: event.model },
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
    if (event.toolName === "openclaw") {
      const directProfile = await resolveProfile(ctx.requester?.channel, ctx.requester?.senderId);
      const owner =
        directProfile?.role === "monarch" || directProfile?.role === "citizen"
          ? ({
              globalId: directProfile.globalId,
              role: directProfile.role,
              source: { kind: "request" },
            } satisfies BillingOwner)
          : await resolveSessionOwner(ctx.sessionKey);
      if (!owner || owner.role !== "monarch") {
        return {
          block: true,
          blockReason: "SG cannot prove monarch ownership for OpenClaw control",
        };
      }
      const delegationSessionId = openClawDelegationSessionId({
        requestedSessionId: event.params.sessionId,
        agentId: ctx.agentId,
        sessionKey: ctx.sessionKey,
      });
      if (!delegationSessionId) {
        return {
          block: true,
          blockReason: "SG cannot correlate the OpenClaw delegation session",
        };
      }
      try {
        await ledger.bindSessionOwner({
          sessionKey: delegatedSessionOwnerKey(delegationSessionId),
          ...owner,
        });
      } catch (error) {
        api.logger?.warn(
          `[sg-billing] OpenClaw delegation owner binding failed safely: ${error instanceof Error ? error.message : String(error)}`,
        );
        return {
          block: true,
          blockReason: "SG billing could not bind the OpenClaw delegation owner",
        };
      }
    }
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
    if (!event.toolCallId) {
      return {
        block: true,
        blockReason: "SG cannot prove the payer or paid-operation correlation",
      };
    }
    try {
      const runId = event.runId ?? ctx.runId;
      let correlation = runId ? await ledger.resolveCorrelation(`run:${runId}`) : undefined;
      if (!correlation) {
        const requester = ctx.requester;
        const profile = await resolveProfile(requester?.channel, requester?.senderId);
        if (profile?.role !== "monarch" && profile?.role !== "citizen") {
          return {
            block: true,
            blockReason: "SG cannot prove the payer or paid-operation correlation",
          };
        }
        const operationId = `tool:${event.toolCallId}`;
        if (profile.role === "monarch") {
          await ledger.startTrackedOperation({
            globalId: profile.globalId,
            operationId,
            role: "monarch",
            source: { kind: "request" },
          });
        } else {
          await ledger.reserveAvailable({
            globalId: profile.globalId,
            operationId,
            source: { kind: "request" },
          });
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
        metadata: { kind: "tool", toolName: event.toolName },
      });
      return undefined;
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
        metadata: {
          kind: "tool",
          provider: event.provider,
          model: event.model,
        },
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
        metadata: {
          kind: "tool",
          provider: event.provider,
          model: event.model,
          ...(event.cost?.evidence === "provider-billed" || event.cost?.evidence === "reconciled"
            ? { costEvidence: event.cost.evidence }
            : {}),
        },
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
