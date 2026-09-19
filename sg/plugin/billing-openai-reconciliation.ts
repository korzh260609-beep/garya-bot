import { createHash } from "node:crypto";
import { readProviderJsonObjectResponse } from "openclaw/plugin-sdk/provider-http";
import {
  asProviderUsageObject,
  cleanProviderUsageCredential,
  fetchProviderUsagePages,
} from "openclaw/plugin-sdk/provider-usage";
import { SgBillingLedger } from "./billing-ledger.js";

const OPENAI_COSTS_URL = "https://api.openai.com/v1/organization/costs";
const OPENAI_SPEND_LIMIT_URL = "https://api.openai.com/v1/organization/spend_limit";
const RESPONSE_MAX_BYTES = 4 * 1024 * 1024;
const DAY_MS = 86_400_000;
const DEFAULT_DAYS = 7;
const MAX_DAYS = 31;

export type SgOpenAiReconciliationResult = {
  projectId: string;
  startMs: number;
  endMs: number;
  windowCount: number;
  providerCostNanoUsd: number;
  attributedCostNanoUsd: number;
  differenceNanoUsd: number;
  spendLimitNanoUsd?: number;
  spendLimitEnforcement?: "inactive" | "enforcing";
};

async function fetchOpenAiSpendLimit(params: {
  adminKey: string;
  fetchFn: typeof fetch;
  timeoutMs: number;
}): Promise<{ spendLimitNanoUsd: number; enforcement: "inactive" | "enforcing" } | undefined> {
  let response: Response;
  try {
    response = await params.fetchFn(OPENAI_SPEND_LIMIT_URL, {
      headers: { Accept: "application/json", Authorization: `Bearer ${params.adminKey}` },
      signal: AbortSignal.timeout(params.timeoutMs),
    });
  } catch {
    return undefined;
  }
  if (!response.ok) {
    return undefined;
  }
  try {
    const payload = await readProviderJsonObjectResponse(response, "OpenAI spend limit", {
      maxBytes: RESPONSE_MAX_BYTES,
      timeoutMs: params.timeoutMs,
    });
    const enforcement = asProviderUsageObject(payload.enforcement);
    const thresholdAmount = payload.threshold_amount;
    const status = enforcement?.status;
    if (
      payload.currency !== "usd" ||
      payload.interval !== "month" ||
      !Number.isSafeInteger(thresholdAmount) ||
      (thresholdAmount as number) < 0 ||
      (status !== "inactive" && status !== "enforcing")
    ) {
      return undefined;
    }
    const spendLimitNanoUsd = (thresholdAmount as number) * 10_000_000;
    return Number.isSafeInteger(spendLimitNanoUsd)
      ? { spendLimitNanoUsd, enforcement: status }
      : undefined;
  } catch {
    return undefined;
  }
}

function exactDecimalUsdToNanoUsd(value: unknown): number {
  if (value === undefined) {
    return 0;
  }
  const text =
    typeof value === "string"
      ? value.trim()
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : "";
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/u.exec(text);
  if (!match) {
    throw new Error("sg-billing-admin-cost-invalid");
  }
  const negative = match[1] === "-";
  const fraction = match[3] ?? "";
  const digits = `${match[2]}${fraction}`.replace(/^0+/u, "") || "0";
  const nanoShift = BigInt(match[4] ?? "0") + 9n - BigInt(fraction.length);
  let nanoUsd: bigint;
  if (digits === "0") {
    nanoUsd = 0n;
  } else if (nanoShift >= 0n) {
    if (BigInt(digits.length) + nanoShift > 16n) {
      throw new Error("sg-billing-admin-cost-overflow");
    }
    nanoUsd = BigInt(digits) * 10n ** nanoShift;
  } else {
    const integerLength = BigInt(digits.length) + nanoShift;
    if (integerLength < 0n) {
      nanoUsd = 0n;
    } else if (integerLength === 0n) {
      nanoUsd = digits[0]! >= "5" ? 1n : 0n;
    } else {
      const split = Number(integerLength);
      nanoUsd = BigInt(digits.slice(0, split));
      if (digits[split]! >= "5") {
        nanoUsd += 1n;
      }
    }
  }
  if (negative) {
    nanoUsd = -nanoUsd;
  }
  if (nanoUsd > BigInt(Number.MAX_SAFE_INTEGER) || nanoUsd < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error("sg-billing-admin-cost-overflow");
  }
  return Number(nanoUsd);
}

function checkedAddSigned(left: number, right: number): number {
  const value = left + right;
  if (!Number.isSafeInteger(value)) {
    throw new Error("sg-billing-admin-cost-overflow");
  }
  return value;
}

function closedPeriod(now: number, daysInput: number | undefined) {
  const days = Math.max(1, Math.min(MAX_DAYS, Math.trunc(daysInput ?? DEFAULT_DAYS)));
  const current = new Date(now);
  const endMs = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate());
  return { days, startMs: endMs - days * DAY_MS, endMs };
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function reconcileOpenAiBilling(params: {
  stateDir: string;
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
  now?: number;
  days?: number;
  timeoutMs?: number;
}): Promise<SgOpenAiReconciliationResult> {
  const env = params.env ?? process.env;
  const adminKey = cleanProviderUsageCredential(env.OPENAI_ADMIN_KEY);
  const projectId = cleanProviderUsageCredential(env.OPENAI_PROJECT_ID);
  if (!adminKey) {
    throw new Error("sg-billing-admin-key-missing");
  }
  if (!projectId) {
    throw new Error("sg-billing-openai-project-id-missing");
  }
  const period = closedPeriod(params.now ?? Date.now(), params.days);
  const response = await fetchProviderUsagePages({
    responseLabel: "OpenAI billing reconciliation",
    responseMaxBytes: RESPONSE_MAX_BYTES,
    timeoutMs: params.timeoutMs ?? 15_000,
    fetchFn: params.fetchFn ?? fetch,
    buildRequest: (page) => {
      const url = new URL(OPENAI_COSTS_URL);
      url.searchParams.set("start_time", String(Math.floor(period.startMs / 1000)));
      url.searchParams.set("end_time", String(Math.floor(period.endMs / 1000)));
      url.searchParams.set("bucket_width", "1d");
      url.searchParams.set("limit", String(period.days));
      // Match the official SDK array serialization (`arrayFormat: brackets`).
      url.searchParams.set("group_by[]", "line_item");
      url.searchParams.set("project_ids[]", projectId);
      if (page) {
        url.searchParams.set("page", page);
      }
      return {
        url,
        headers: { Accept: "application/json", Authorization: `Bearer ${adminKey}` },
      };
    },
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("sg-billing-admin-key-rejected");
    }
    throw new Error("sg-billing-admin-usage-unavailable");
  }
  const spendLimit = await fetchOpenAiSpendLimit({
    adminKey,
    fetchFn: params.fetchFn ?? fetch,
    timeoutMs: params.timeoutMs ?? 15_000,
  });

  const providerByStart = new Map<number, { total: number; evidence: unknown[] }>();
  for (const rawBucket of response.data) {
    const bucket = asProviderUsageObject(rawBucket);
    const startSeconds = bucket?.start_time;
    const endSeconds = bucket?.end_time;
    if (
      typeof startSeconds !== "number" ||
      !Number.isInteger(startSeconds) ||
      typeof endSeconds !== "number" ||
      !Number.isInteger(endSeconds) ||
      endSeconds <= startSeconds ||
      !Array.isArray(bucket?.results)
    ) {
      throw new Error("sg-billing-admin-response-invalid");
    }
    const startMs = startSeconds * 1_000;
    const endMs = endSeconds * 1_000;
    if (
      startMs < period.startMs ||
      endMs > period.endMs ||
      endMs - startMs !== DAY_MS ||
      startMs % DAY_MS !== 0
    ) {
      throw new Error("sg-billing-admin-window-invalid");
    }
    let total = 0;
    for (const rawResult of bucket.results) {
      const result = asProviderUsageObject(rawResult);
      const amount = asProviderUsageObject(result?.amount);
      const currency = typeof amount?.currency === "string" ? amount.currency.toLowerCase() : "";
      if (currency !== "usd") {
        throw new Error("sg-billing-admin-currency-invalid");
      }
      total = checkedAddSigned(total, exactDecimalUsdToNanoUsd(amount?.value));
    }
    const existing = providerByStart.get(startMs);
    providerByStart.set(startMs, {
      total: checkedAddSigned(existing?.total ?? 0, total),
      evidence: [...(existing?.evidence ?? []), rawBucket],
    });
  }

  const ledger = new SgBillingLedger(params.stateDir);
  let providerCostNanoUsd = 0;
  let attributedCostNanoUsd = 0;
  let differenceNanoUsd = 0;
  try {
    for (let startMs = period.startMs; startMs < period.endMs; startMs += DAY_MS) {
      const endMs = startMs + DAY_MS;
      const provider = providerByStart.get(startMs) ?? { total: 0, evidence: [] };
      const attributed = await ledger.actualCostForWindow({ startMs, endMs });
      const difference = provider.total - attributed;
      const sourceDigest = digest({
        provider: "openai",
        projectId,
        startMs,
        endMs,
        providerCostNanoUsd: provider.total,
        attributedCostNanoUsd: attributed,
        evidence: provider.evidence,
      });
      await ledger.recordReconciliationWindow({
        provider: "openai",
        projectId,
        windowStartMs: startMs,
        windowEndMs: endMs,
        providerCostNanoUsd: provider.total,
        attributedCostNanoUsd: attributed,
        differenceNanoUsd: difference,
        sourceDigest,
      });
      providerCostNanoUsd = checkedAddSigned(providerCostNanoUsd, provider.total);
      attributedCostNanoUsd = checkedAddSigned(attributedCostNanoUsd, attributed);
      differenceNanoUsd = checkedAddSigned(differenceNanoUsd, difference);
    }
    if (spendLimit) {
      await ledger.recordProviderFinancialSnapshot({
        provider: "openai",
        spendLimitNanoUsd: spendLimit.spendLimitNanoUsd,
        enforcement: spendLimit.enforcement,
        interval: "month",
        syncedAt: params.now ?? Date.now(),
      });
    }
  } finally {
    ledger.close();
  }
  return {
    projectId,
    startMs: period.startMs,
    endMs: period.endMs,
    windowCount: period.days,
    providerCostNanoUsd,
    attributedCostNanoUsd,
    differenceNanoUsd,
    ...(spendLimit
      ? {
          spendLimitNanoUsd: spendLimit.spendLimitNanoUsd,
          spendLimitEnforcement: spendLimit.enforcement,
        }
      : {}),
  };
}
