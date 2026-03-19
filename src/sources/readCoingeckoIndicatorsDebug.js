// src/sources/readCoingeckoIndicatorsDebug.js
// ============================================================================
// STAGE 10C.29
// SG DEBUG READER — COINGECKO INDICATORS
//
// PURPOSE:
// - read existing protected debug endpoint for coingecko indicators
// - normalize tiny SG-friendly interpretation snapshot
// - no chat wiring
// - no SourceService changes
// - no indicator math here
// - no execution logic here
//
// IMPORTANT:
// - this reader depends on existing debug route
// - route must already be enabled by DEBUG_SOURCE_TESTS + DEBUG_SOURCE_TOKEN
// - fail-open
// ============================================================================

import { fetchWithTimeout } from "../core/fetchWithTimeout.js";

export const COINGECKO_INDICATORS_DEBUG_READER_VERSION =
  "10C.29-debug-reader-v2";

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_PATH = "/debug/source/coingecko-indicators";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const out = Math.trunc(n);
  return out > 0 ? out : fallback;
}

function normalizeCoinId(value) {
  return normalizeString(value).toLowerCase() || "bitcoin";
}

function normalizeVsCurrency(value) {
  return normalizeString(value).toLowerCase() || "usd";
}

function normalizeDays(value) {
  const raw = normalizeString(value).toLowerCase();

  if (!raw) return "30";
  if (raw === "max") return "max";

  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) {
    return String(Math.trunc(n));
  }

  return "30";
}

function normalizeInterval(value) {
  const raw = normalizeString(value).toLowerCase();

  if (!raw) return "";
  if (raw === "daily") return "daily";
  if (raw === "hourly") return "hourly";

  return "";
}

function getBaseUrlFromEnv() {
  return (
    normalizeString(process.env.DEBUG_SOURCE_BASE_URL) ||
    normalizeString(process.env.RENDER_EXTERNAL_URL) ||
    normalizeString(process.env.PUBLIC_BASE_URL) ||
    normalizeString(process.env.APP_BASE_URL) ||
    ""
  );
}

function stripTrailingSlash(value) {
  return normalizeString(value).replace(/\/+$/, "");
}

function buildDebugUrl({
  baseUrl,
  token,
  coinId,
  vsCurrency,
  days,
  interval,
  emaPeriod,
  rsiPeriod,
}) {
  const safeBaseUrl = stripTrailingSlash(baseUrl);
  const params = new URLSearchParams();

  params.set("token", token);
  params.set("coinId", coinId);
  params.set("vsCurrency", vsCurrency);
  params.set("days", days);

  if (interval) {
    params.set("interval", interval);
  }

  params.set("emaPeriod", String(emaPeriod));
  params.set("rsiPeriod", String(rsiPeriod));

  return `${safeBaseUrl}${DEFAULT_PATH}?${params.toString()}`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeJsonParse(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch (_) {
    return null;
  }
}

function extractUpstreamMeta(payload) {
  const marketChart = isPlainObject(payload?.marketChart) ? payload.marketChart : {};
  const indicators = isPlainObject(payload?.indicators) ? payload.indicators : {};

  return {
    routeOk: payload?.ok === true,
    error: payload?.error || null,
    message: payload?.message || null,
    upstreamReason: marketChart?.reason || indicators?.reason || null,
    upstreamStatus:
      typeof marketChart?.status === "number" ? marketChart.status : null,
    upstreamPricesCount:
      typeof marketChart?.pricesCount === "number" ? marketChart.pricesCount : null,
    marketChartOk: marketChart?.ok === true,
    indicatorsOk: indicators?.ok === true,
  };
}

function buildNotReadyResult(reason, extra = {}) {
  return {
    ok: false,
    sourceKey: "coingecko_indicators_debug_reader",
    readerVersion: COINGECKO_INDICATORS_DEBUG_READER_VERSION,
    reason,
    fetchedAt: new Date().toISOString(),
    request: {
      url: extra.url || null,
      coinId: extra.coinId || null,
      vsCurrency: extra.vsCurrency || null,
      days: extra.days || null,
      interval: extra.interval || null,
      emaPeriod: extra.emaPeriod || null,
      rsiPeriod: extra.rsiPeriod || null,
    },
    http: {
      status: extra.status ?? null,
      statusText: extra.statusText || null,
      durationMs: extra.durationMs ?? null,
    },
    raw: {
      debugText: extra.debugText || null,
      rawPreview: extra.rawPreview || null,
    },
    snapshot: {
      signal: null,
      confidence: null,
      triggerStatus: null,
      readinessScore: null,
      readinessLabel: null,
      bias: null,
      hint: null,
      context: null,
      setup: null,
      priority: null,
      attentionLevel: null,
      shouldWaitForConfirmation: null,
      explanationShort: null,
      branchReason: null,
      note: null,
      summaryLine: null,
      basedOn: {
        marketBias: null,
        momentumBias: null,
        trendStrength: null,
        signalSummary: null,
      },
    },
    sgView: {
      branch: null,
      status: "not_ready",
      readiness: null,
      shortText: null,
      note: null,
    },
    meta: extra.meta || {},
  };
}

function buildReadyResult({
  payload,
  url,
  coinId,
  vsCurrency,
  days,
  interval,
  emaPeriod,
  rsiPeriod,
  status,
  statusText,
  durationMs,
}) {
  const indicators = isPlainObject(payload?.indicators) ? payload.indicators : {};
  const summary = isPlainObject(indicators?.summary) ? indicators.summary : {};
  const signalSummary = isPlainObject(summary?.signalSummary)
    ? summary.signalSummary
    : {};
  const entryHints = isPlainObject(indicators?.entryHints)
    ? indicators.entryHints
    : {};
  const basedOn = isPlainObject(entryHints?.basedOn) ? entryHints.basedOn : {};

  const signal = normalizeString(signalSummary?.signal) || null;
  const confidence = normalizeString(entryHints?.confidence) || null;
  const triggerStatus = normalizeString(entryHints?.triggerStatus) || null;
  const readinessLabel = normalizeString(entryHints?.readinessLabel) || null;
  const bias = normalizeString(entryHints?.bias) || null;
  const hint = normalizeString(entryHints?.hint) || null;
  const context = normalizeString(entryHints?.context) || null;
  const setup = normalizeString(entryHints?.setup) || null;
  const priority = normalizeString(entryHints?.priority) || null;
  const attentionLevel = normalizeString(entryHints?.attentionLevel) || null;
  const explanationShort = normalizeString(entryHints?.explanationShort) || null;
  const branchReason = normalizeString(entryHints?.branchReason) || null;
  const note = normalizeString(entryHints?.note) || null;
  const summaryLine = normalizeString(entryHints?.summaryLine) || null;

  return {
    ok: true,
    sourceKey: "coingecko_indicators_debug_reader",
    readerVersion: COINGECKO_INDICATORS_DEBUG_READER_VERSION,
    reason: "coingecko_indicators_debug_read_ready",
    fetchedAt: new Date().toISOString(),
    request: {
      url,
      coinId,
      vsCurrency,
      days,
      interval: interval || null,
      emaPeriod,
      rsiPeriod,
    },
    http: {
      status,
      statusText: statusText || null,
      durationMs,
    },
    raw: {
      debugText: normalizeString(payload?.debugText) || null,
      routeOk: payload?.ok === true,
      marketChartOk: payload?.marketChart?.ok === true,
      marketChartReason: payload?.marketChart?.reason || null,
      pricesCount: payload?.marketChart?.pricesCount ?? null,
    },
    snapshot: {
      signal,
      confidence,
      triggerStatus,
      readinessScore:
        typeof entryHints?.readinessScore === "number"
          ? entryHints.readinessScore
          : null,
      readinessLabel,
      bias,
      hint,
      context,
      setup,
      priority,
      attentionLevel,
      shouldWaitForConfirmation:
        typeof entryHints?.shouldWaitForConfirmation === "boolean"
          ? entryHints.shouldWaitForConfirmation
          : null,
      explanationShort,
      branchReason,
      note,
      summaryLine,
      basedOn: {
        marketBias: normalizeString(basedOn?.marketBias) || null,
        momentumBias: normalizeString(basedOn?.momentumBias) || null,
        trendStrength: normalizeString(basedOn?.trendStrength) || null,
        signalSummary: normalizeString(basedOn?.signalSummary) || null,
      },
    },
    sgView: {
      branch: signal,
      status: triggerStatus || "unknown",
      readiness: readinessLabel,
      shortText: explanationShort,
      note,
    },
    meta: {
      summaryOk: summary?.ok === true,
      signalSummaryOk: signalSummary?.ok === true,
      entryHintsOk: entryHints?.ok === true,
      bundleOk: indicators?.ok === true,
      bundleReason: indicators?.reason || null,
    },
  };
}

export async function readCoingeckoIndicatorsDebug(input = {}) {
  const baseUrl = normalizeString(input?.baseUrl) || getBaseUrlFromEnv();
  const token =
    normalizeString(input?.token) ||
    normalizeString(process.env.DEBUG_SOURCE_TOKEN);
  const coinId = normalizeCoinId(input?.coinId);
  const vsCurrency = normalizeVsCurrency(input?.vsCurrency);
  const days = normalizeDays(input?.days);
  const interval = normalizeInterval(input?.interval);
  const emaPeriod = normalizePositiveInt(input?.emaPeriod, 20);
  const rsiPeriod = normalizePositiveInt(input?.rsiPeriod, 14);
  const timeoutMs = normalizePositiveInt(input?.timeoutMs, DEFAULT_TIMEOUT_MS);

  if (!baseUrl) {
    return buildNotReadyResult("missing_base_url", {
      coinId,
      vsCurrency,
      days,
      interval,
      emaPeriod,
      rsiPeriod,
    });
  }

  if (!token) {
    return buildNotReadyResult("missing_debug_token", {
      coinId,
      vsCurrency,
      days,
      interval,
      emaPeriod,
      rsiPeriod,
    });
  }

  const url = buildDebugUrl({
    baseUrl,
    token,
    coinId,
    vsCurrency,
    days,
    interval,
    emaPeriod,
    rsiPeriod,
  });

  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      },
      timeoutMs
    );

    const durationMs = Date.now() - startedAt;
    const rawText = await response.text();
    const payload = safeJsonParse(rawText);

    if (!response.ok) {
      const upstreamMeta = extractUpstreamMeta(payload);

      return buildNotReadyResult("http_error", {
        url,
        coinId,
        vsCurrency,
        days,
        interval,
        emaPeriod,
        rsiPeriod,
        status: response.status,
        statusText: response.statusText || "",
        durationMs,
        rawPreview: typeof rawText === "string" ? rawText.slice(0, 1000) : "",
        debugText: normalizeString(payload?.debugText) || null,
        meta: upstreamMeta,
      });
    }

    if (!isPlainObject(payload)) {
      return buildNotReadyResult("payload_not_object", {
        url,
        coinId,
        vsCurrency,
        days,
        interval,
        emaPeriod,
        rsiPeriod,
        status: response.status,
        statusText: response.statusText || "",
        durationMs,
        rawPreview: typeof rawText === "string" ? rawText.slice(0, 1000) : "",
      });
    }

    if (!isPlainObject(payload?.indicators)) {
      return buildNotReadyResult("indicators_missing", {
        url,
        coinId,
        vsCurrency,
        days,
        interval,
        emaPeriod,
        rsiPeriod,
        status: response.status,
        statusText: response.statusText || "",
        durationMs,
        rawPreview: typeof rawText === "string" ? rawText.slice(0, 1000) : "",
        debugText: normalizeString(payload?.debugText) || null,
        meta: {
          routeOk: payload?.ok === true,
          marketChartOk: payload?.marketChart?.ok === true,
          upstreamReason: payload?.marketChart?.reason || null,
          upstreamStatus:
            typeof payload?.marketChart?.status === "number"
              ? payload.marketChart.status
              : null,
          upstreamPricesCount:
            typeof payload?.marketChart?.pricesCount === "number"
              ? payload.marketChart.pricesCount
              : null,
        },
      });
    }

    return buildReadyResult({
      payload,
      url,
      coinId,
      vsCurrency,
      days,
      interval,
      emaPeriod,
      rsiPeriod,
      status: response.status,
      statusText: response.statusText || "",
      durationMs,
    });
  } catch (error) {
    return buildNotReadyResult("network_error", {
      url,
      coinId,
      vsCurrency,
      days,
      interval,
      emaPeriod,
      rsiPeriod,
      meta: {
        message: error?.message ? String(error.message) : "unknown_error",
      },
    });
  }
}

export default {
  readCoingeckoIndicatorsDebug,
};