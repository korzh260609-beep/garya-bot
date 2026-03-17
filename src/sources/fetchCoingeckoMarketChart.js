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

import fetch from "node-fetch";

export const COINGECKO_MARKET_CHART_VERSION = "10C.7-market-chart-fetcher-v1";

const COINGECKO_MARKET_CHART_BASE_URL =
  "https://api.coingecko.com/api/v3/coins";

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

export async function fetchCoinGeckoMarketChart(input = {}) {
  const coinId = normalizeCoinId(input?.coinId);
  const vsCurrency = normalizeVsCurrency(input?.vsCurrency);
  const days = normalizeDays(input?.days);
  const interval = normalizeInterval(input?.interval);
  const limitPreviewPoints = normalizePositiveInt(input?.limitPreviewPoints, 3);

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

  const url = buildUrl({
    coinId,
    vsCurrency,
    days,
    interval,
  });

  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    });

    const fetchedAt = new Date().toISOString();
    const durationMs = Date.now() - startedAt;
    const rawText = await response.text();

    let payload = null;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch (_) {
      payload = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        sourceKey: "coingecko_market_chart",
        content: "",
        fetchedAt,
        meta: {
          version: COINGECKO_MARKET_CHART_VERSION,
          reason: "http_error",
          status: response.status,
          statusText: response.statusText || "",
          url,
          durationMs,
          coinId,
          vsCurrency,
          days,
          interval: interval || null,
          rawPreview: typeof rawText === "string" ? rawText.slice(0, 500) : "",
        },
      };
    }

    const parsedResult = parseCoinGeckoMarketChartPayload(payload);

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
      interval,
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
        status: response.status,
        url,
        durationMs,
        coinId,
        vsCurrency,
        days,
        interval: interval || null,
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
  } catch (error) {
    return {
      ok: false,
      sourceKey: "coingecko_market_chart",
      content: "",
      fetchedAt: new Date().toISOString(),
      meta: {
        version: COINGECKO_MARKET_CHART_VERSION,
        reason: "network_error",
        message: error?.message ? String(error.message) : "unknown_error",
        coinId,
        vsCurrency,
        days,
        interval: interval || null,
        url,
      },
    };
  }
}

export default {
  fetchCoinGeckoMarketChart,
};