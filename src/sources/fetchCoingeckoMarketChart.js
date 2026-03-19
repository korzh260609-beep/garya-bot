// src/sources/fetchCoingeckoMarketChart.js
// ============================================================================
// STAGE 10C.7 — CoinGecko historical market_chart fetcher
// PURPOSE:
// - provide deterministic historical-data fetch layer for market_chart
// - keep network logic OUT of chat handler
// - keep parser deterministic and fail-open
// - align source metadata versioning with current debug/source stage
//
// IMPORTANT:
// - this module is fetcher-only
// - this module is used by SourceService
// - this module does NOT do chat wiring by itself
// - no indicators here
// - no TA text here
// - caller layer decides whether/how to use this result
// ============================================================================

import { fetchWithTimeout } from "../core/fetchWithTimeout.js";

export const COINGECKO_MARKET_CHART_VERSION = "10C.33-market-chart-fetcher-v3";

const COINGECKO_MARKET_CHART_BASE_URL =
  "https://api.coingecko.com/api/v3/coins";

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRY_DELAY_MS = 700;
const DEFAULT_MAX_ATTEMPTS = 2;

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
  return normalizeString(value).toLowerCase();
}

function normalizeVsCurrency(value) {
  const vs = normalizeString(value).toLowerCase();
  return vs || "usd";
}

function normalizeDays(value) {
  const raw = normalizeString(value).toLowerCase();

  if (!raw) return "7";
  if (raw === "max") return "max";

  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) {
    return String(Math.trunc(n));
  }

  return "7";
}

function normalizeInterval(value) {
  const raw = normalizeString(value).toLowerCase();

  if (!raw) return "";
  if (raw === "daily") return "daily";
  if (raw === "hourly") return "hourly";

  return "";
}

function buildQuery({ vsCurrency, days, interval }) {
  const params = new URLSearchParams();

  params.set("vs_currency", vsCurrency);
  params.set("days", days);

  if (interval) {
    params.set("interval", interval);
  }

  return params.toString();
}

function buildUrl({ coinId, vsCurrency, days, interval }) {
  const encodedCoinId = encodeURIComponent(coinId);
  return `${COINGECKO_MARKET_CHART_BASE_URL}/${encodedCoinId}/market_chart?${buildQuery({
    vsCurrency,
    days,
    interval,
  })}`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidPoint(point) {
  return (
    Array.isArray(point) &&
    point.length >= 2 &&
    typeof point[0] === "number" &&
    Number.isFinite(point[0]) &&
    typeof point[1] === "number" &&
    Number.isFinite(point[1])
  );
}

function normalizePointSeries(value) {
  if (!Array.isArray(value)) return [];

  const out = [];

  for (const point of value) {
    if (!isValidPoint(point)) continue;

    out.push({
      ts: point[0],
      value: point[1],
    });
  }

  return out;
}

function buildSeriesMeta(series = []) {
  if (!Array.isArray(series) || !series.length) {
    return {
      count: 0,
      firstTs: null,
      lastTs: null,
    };
  }

  return {
    count: series.length,
    firstTs: series[0]?.ts ?? null,
    lastTs: series[series.length - 1]?.ts ?? null,
  };
}

function parseCoinGeckoMarketChartPayload(payload) {
  if (!isPlainObject(payload)) {
    return {
      ok: false,
      reason: "payload_not_object",
      parsed: {
        prices: [],
        marketCaps: [],
        totalVolumes: [],
        meta: {
          prices: buildSeriesMeta([]),
          marketCaps: buildSeriesMeta([]),
          totalVolumes: buildSeriesMeta([]),
        },
      },
    };
  }

  const prices = normalizePointSeries(payload.prices);
  const marketCaps = normalizePointSeries(payload.market_caps);
  const totalVolumes = normalizePointSeries(payload.total_volumes);

  const parsed = {
    prices,
    marketCaps,
    totalVolumes,
    meta: {
      prices: buildSeriesMeta(prices),
      marketCaps: buildSeriesMeta(marketCaps),
      totalVolumes: buildSeriesMeta(totalVolumes),
    },
  };

  const ok = prices.length > 0;

  return {
    ok,
    reason: ok ? "parsed_ok" : "parsed_empty",
    parsed,
  };
}

function formatTs(ts) {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return "n/a";

  try {
    return new Date(ts).toISOString();
  } catch (_) {
    return "n/a";
  }
}

function formatNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";

  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
    }).format(value);
  }

  if (Math.abs(value) >= 1) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 6,
    maximumFractionDigits: 10,
  }).format(value);
}

function buildPreviewLine(name, series = []) {
  if (!Array.isArray(series) || !series.length) {
    return `${name}: empty`;
  }

  const first = series[0];
  const last = series[series.length - 1];

  return (
    `${name}: count=${series.length}` +
    ` | first=${formatNumber(first?.value)} @ ${formatTs(first?.ts)}` +
    ` | last=${formatNumber(last?.value)} @ ${formatTs(last?.ts)}`
  );
}

function buildContentText({ coinId, vsCurrency, days, interval, parsed }) {
  const lines = [
    `coin: ${coinId}`,
    `vs_currency: ${vsCurrency}`,
    `days: ${days}`,
    `interval: ${interval || "auto"}`,
    buildPreviewLine("prices", parsed?.prices || []),
    buildPreviewLine("market_caps", parsed?.marketCaps || []),
    buildPreviewLine("total_volumes", parsed?.totalVolumes || []),
  ];

  return lines.join("\n");
}

function buildHeaders() {
  return {
    accept: "application/json",
    "user-agent": "SG-GARYA/10C-market-chart (+Render; debug-safe)",
  };
}

function safeJsonParse(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch (_) {
    return null;
  }
}

function shouldRetryHttpStatus(status) {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function shouldRetryErrorMessage(message) {
  const text = normalizeString(message).toLowerCase();
  if (!text) return false;

  return (
    text.includes("timeout") ||
    text.includes("fetch failed") ||
    text.includes("socket") ||
    text.includes("econnreset") ||
    text.includes("etimedout") ||
    text.includes("network") ||
    text.includes("aborted")
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldTryHourlyFallback({ days, interval }) {
  if (interval === "hourly") return false;
  if (days === "max") return false;

  const n = Number(days);
  if (!Number.isFinite(n)) return false;

  return n > 0 && n <= 90;
}

function buildAttemptSnapshot({
  attempt,
  phase,
  interval,
  ok,
  status,
  statusText,
  durationMs,
  errorMessage,
  rawText,
  payload,
}) {
  return {
    attempt,
    phase,
    interval: interval || "auto",
    ok: Boolean(ok),
    status: typeof status === "number" ? status : null,
    statusText: statusText || "",
    durationMs: typeof durationMs === "number" ? durationMs : null,
    errorMessage: errorMessage || null,
    rawPreview: typeof rawText === "string" ? rawText.slice(0, 500) : "",
    payloadOk: payload?.ok === true,
    payloadError: normalizeString(payload?.error) || null,
    payloadMessage: normalizeString(payload?.message) || null,
  };
}

async function fetchMarketChartAttempt({ url, timeoutMs, interval, phase, attempt }) {
  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: buildHeaders(),
      },
      timeoutMs
    );

    const durationMs = Date.now() - startedAt;
    const rawText = await response.text();
    const payload = safeJsonParse(rawText);

    return {
      attempt,
      phase,
      interval,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText || "",
      durationMs,
      rawText,
      payload,
      errorMessage: null,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    return {
      attempt,
      phase,
      interval,
      ok: false,
      status: null,
      statusText: "",
      durationMs,
      rawText: "",
      payload: null,
      errorMessage: error?.message ? String(error.message) : "unknown_error",
    };
  }
}

async function runAttemptsForInterval({
  coinId,
  vsCurrency,
  days,
  interval,
  timeoutMs,
  maxAttempts,
  retryDelayMs,
  phase,
}) {
  const url = buildUrl({
    coinId,
    vsCurrency,
    days,
    interval,
  });

  const attempts = [];
  let lastAttempt = null;

  for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex += 1) {
    const attemptNo = attemptIndex + 1;

    const attempt = await fetchMarketChartAttempt({
      url,
      timeoutMs,
      interval,
      phase,
      attempt: attemptNo,
    });

    attempts.push(
      buildAttemptSnapshot({
        ...attempt,
      })
    );

    lastAttempt = attempt;

    if (attempt.ok) {
      break;
    }

    const canRetry =
      attemptNo < maxAttempts &&
      ((typeof attempt.status === "number" && shouldRetryHttpStatus(attempt.status)) ||
        shouldRetryErrorMessage(attempt.errorMessage));

    if (!canRetry) {
      break;
    }

    await delay(retryDelayMs);
  }

  return {
    url,
    attempts,
    lastAttempt,
  };
}

function buildFailureMeta({
  fetchedAt,
  coinId,
  vsCurrency,
  days,
  interval,
  url,
  lastAttempt,
  attempts,
}) {
  if (!lastAttempt) {
    return {
      ok: false,
      sourceKey: "coingecko_market_chart",
      content: "",
      fetchedAt,
      meta: {
        version: COINGECKO_MARKET_CHART_VERSION,
        reason: "no_attempt_result",
        coinId,
        vsCurrency,
        days,
        interval: interval || null,
        url,
        attempts,
      },
    };
  }

  if (typeof lastAttempt.status === "number") {
    return {
      ok: false,
      sourceKey: "coingecko_market_chart",
      content: "",
      fetchedAt,
      meta: {
        version: COINGECKO_MARKET_CHART_VERSION,
        reason: "http_error",
        status: lastAttempt.status,
        statusText: lastAttempt.statusText || "",
        url,
        durationMs: lastAttempt.durationMs,
        coinId,
        vsCurrency,
        days,
        interval: interval || null,
        rawPreview:
          typeof lastAttempt.rawText === "string"
            ? lastAttempt.rawText.slice(0, 500)
            : "",
        attempts,
      },
    };
  }

  return {
    ok: false,
    sourceKey: "coingecko_market_chart",
    content: "",
    fetchedAt,
    meta: {
      version: COINGECKO_MARKET_CHART_VERSION,
      reason: "network_error",
      message: lastAttempt.errorMessage || "unknown_error",
      coinId,
      vsCurrency,
      days,
      interval: interval || null,
      url,
      durationMs: lastAttempt.durationMs,
      attempts,
    },
  };
}

export async function fetchCoinGeckoMarketChart(input = {}) {
  const coinId = normalizeCoinId(input?.coinId);
  const vsCurrency = normalizeVsCurrency(input?.vsCurrency);
  const days = normalizeDays(input?.days);
  const interval = normalizeInterval(input?.interval);
  const limitPreviewPoints = normalizePositiveInt(input?.limitPreviewPoints, 3);
  const timeoutMs = normalizePositiveInt(input?.timeoutMs, DEFAULT_TIMEOUT_MS);
  const maxAttempts = normalizePositiveInt(input?.maxAttempts, DEFAULT_MAX_ATTEMPTS);
  const retryDelayMs = normalizePositiveInt(
    input?.retryDelayMs,
    DEFAULT_RETRY_DELAY_MS
  );

  if (!coinId) {
    return {
      ok: false,
      sourceKey: "coingecko_market_chart",
      content: "",
      fetchedAt: new Date().toISOString(),
      meta: {
        version: COINGECKO_MARKET_CHART_VERSION,
        reason: "missing_coin_id",
      },
    };
  }

  const primaryRun = await runAttemptsForInterval({
    coinId,
    vsCurrency,
    days,
    interval,
    timeoutMs,
    maxAttempts,
    retryDelayMs,
    phase: "primary",
  });

  let chosenRun = primaryRun;
  let fallbackUsed = false;

  if (
    !primaryRun?.lastAttempt?.ok &&
    shouldTryHourlyFallback({ days, interval })
  ) {
    const fallbackRun = await runAttemptsForInterval({
      coinId,
      vsCurrency,
      days,
      interval: "hourly",
      timeoutMs,
      maxAttempts,
      retryDelayMs,
      phase: "fallback_hourly",
    });

    if (fallbackRun?.lastAttempt?.ok) {
      chosenRun = fallbackRun;
      fallbackUsed = true;
      chosenRun.attempts = [
        ...(primaryRun?.attempts || []),
        ...(fallbackRun?.attempts || []),
      ];
    } else {
      primaryRun.attempts = [
        ...(primaryRun?.attempts || []),
        ...(fallbackRun?.attempts || []),
      ];
      chosenRun = {
        ...primaryRun,
        attempts: primaryRun.attempts,
      };
    }
  }

  const fetchedAt = new Date().toISOString();
  const lastAttempt = chosenRun?.lastAttempt || null;
  const attempts = chosenRun?.attempts || [];
  const finalInterval = fallbackUsed ? "hourly" : interval;
  const finalUrl = chosenRun?.url || buildUrl({ coinId, vsCurrency, days, interval });

  if (!lastAttempt?.ok) {
    return buildFailureMeta({
      fetchedAt,
      coinId,
      vsCurrency,
      days,
      interval: finalInterval,
      url: finalUrl,
      lastAttempt,
      attempts,
    });
  }

  const parsedResult = parseCoinGeckoMarketChartPayload(lastAttempt.payload);

  if (
    !parsedResult.ok &&
    !fallbackUsed &&
    shouldTryHourlyFallback({ days, interval })
  ) {
    const fallbackRun = await runAttemptsForInterval({
      coinId,
      vsCurrency,
      days,
      interval: "hourly",
      timeoutMs,
      maxAttempts,
      retryDelayMs,
      phase: "fallback_hourly_after_empty",
    });

    const mergedAttempts = [
      ...attempts,
      ...(fallbackRun?.attempts || []),
    ];

    if (fallbackRun?.lastAttempt?.ok) {
      const fallbackParsedResult = parseCoinGeckoMarketChartPayload(
        fallbackRun.lastAttempt.payload
      );

      if (fallbackParsedResult.ok) {
        const pricesPreview = (fallbackParsedResult?.parsed?.prices || []).slice(
          0,
          limitPreviewPoints
        );
        const marketCapsPreview = (
          fallbackParsedResult?.parsed?.marketCaps || []
        ).slice(0, limitPreviewPoints);
        const totalVolumesPreview = (
          fallbackParsedResult?.parsed?.totalVolumes || []
        ).slice(0, limitPreviewPoints);

        const content = buildContentText({
          coinId,
          vsCurrency,
          days,
          interval: "hourly",
          parsed: fallbackParsedResult.parsed,
        });

        return {
          ok: true,
          sourceKey: "coingecko_market_chart",
          content,
          fetchedAt,
          meta: {
            version: COINGECKO_MARKET_CHART_VERSION,
            reason: fallbackParsedResult.reason,
            status: fallbackRun.lastAttempt.status,
            url: fallbackRun.url,
            durationMs: fallbackRun.lastAttempt.durationMs,
            coinId,
            vsCurrency,
            days,
            interval: "hourly",
            fallbackUsed: true,
            fallbackReason: "primary_parsed_empty",
            attempts: mergedAttempts,
            parsed: {
              prices: fallbackParsedResult.parsed.prices,
              marketCaps: fallbackParsedResult.parsed.marketCaps,
              totalVolumes: fallbackParsedResult.parsed.totalVolumes,
              meta: fallbackParsedResult.parsed.meta,
            },
            preview: {
              prices: pricesPreview,
              marketCaps: marketCapsPreview,
              totalVolumes: totalVolumesPreview,
            },
          },
        };
      }
    }

    return buildFailureMeta({
      fetchedAt,
      coinId,
      vsCurrency,
      days,
      interval,
      url: fallbackRun?.url || finalUrl,
      lastAttempt: fallbackRun?.lastAttempt || lastAttempt,
      attempts: mergedAttempts,
    });
  }

  const pricesPreview = (parsedResult?.parsed?.prices || []).slice(
    0,
    limitPreviewPoints
  );
  const marketCapsPreview = (parsedResult?.parsed?.marketCaps || []).slice(
    0,
    limitPreviewPoints
  );
  const totalVolumesPreview = (
    parsedResult?.parsed?.totalVolumes || []
  ).slice(0, limitPreviewPoints);

  const content = buildContentText({
    coinId,
    vsCurrency,
    days,
    interval: finalInterval,
    parsed: parsedResult.parsed,
  });

  return {
    ok: parsedResult.ok,
    sourceKey: "coingecko_market_chart",
    content,
    fetchedAt,
    meta: {
      version: COINGECKO_MARKET_CHART_VERSION,
      reason: parsedResult.reason,
      status: lastAttempt.status,
      url: finalUrl,
      durationMs: lastAttempt.durationMs,
      coinId,
      vsCurrency,
      days,
      interval: finalInterval || null,
      fallbackUsed,
      attempts,
      parsed: {
        prices: parsedResult.parsed.prices,
        marketCaps: parsedResult.parsed.marketCaps,
        totalVolumes: parsedResult.parsed.totalVolumes,
        meta: parsedResult.parsed.meta,
      },
      preview: {
        prices: pricesPreview,
        marketCaps: marketCapsPreview,
        totalVolumes: totalVolumesPreview,
      },
    },
  };
}

export default {
  fetchCoinGeckoMarketChart,
};