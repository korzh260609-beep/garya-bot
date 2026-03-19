// src/sources/readCryptoModuleDiagnostics.js
// ============================================================================
// STAGE 10C.10 — CRYPTO MODULE DIAGNOSTICS (isolated)
// PURPOSE:
// - run compact diagnostics across current crypto/news dev layers
// - keep this layer source-only and deterministic
// - no SourceService changes
// - no chat wiring
// ============================================================================

import { fetchCoinGeckoSimplePrice } from "./fetchCoingeckoSimplePrice.js";
import { fetchCoinGeckoMarketChart } from "./fetchCoingeckoMarketChart.js";
import { fetchCryptoNewsRss } from "./fetchCryptoNewsRss.js";
import { readCoingeckoIndicatorsSnapshot } from "./readCoingeckoIndicatorsSnapshot.js";
import { readCryptoMultiMonitorSnapshot } from "./readCryptoMultiMonitorSnapshot.js";

export const CRYPTO_MODULE_DIAGNOSTICS_VERSION = "10C.10-diagnostics-v1";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const out = Math.trunc(n);
  return out > 0 ? out : fallback;
}

function normalizeIds(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  const out = [];

  for (const item of value) {
    const id = normalizeString(item).toLowerCase();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }

  return out;
}

function normalizeFeedUrls(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  const out = [];

  for (const item of value) {
    const url = normalizeString(item);
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }

  return out;
}

function getDefaultIds() {
  return ["bitcoin", "ethereum"];
}

function getDefaultFeedUrls() {
  return [
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://cointelegraph.com/rss",
  ];
}

function getSimplePriceMeta(result = {}) {
  return {
    ok: result?.ok === true,
    reason: result?.meta?.reason || null,
    status: result?.meta?.status ?? null,
    durationMs: result?.meta?.durationMs ?? null,
    parsedCount:
      result?.meta?.parsed && typeof result.meta.parsed === "object"
        ? Object.keys(result.meta.parsed).length
        : 0,
  };
}

function getMarketChartMeta(result = {}) {
  return {
    ok: result?.ok === true,
    reason: result?.meta?.reason || null,
    status: result?.meta?.status ?? null,
    durationMs: result?.meta?.durationMs ?? null,
    pricesCount: result?.meta?.parsed?.meta?.prices?.count ?? 0,
    intervalUsed: result?.meta?.interval || null,
    fallbackUsed: result?.meta?.fallbackUsed === true,
  };
}

function getNewsMeta(result = {}) {
  return {
    ok: result?.ok === true,
    reason: result?.meta?.reason || null,
    totalFeeds: result?.meta?.totalFeeds ?? null,
    successfulFeeds: result?.meta?.successfulFeeds ?? null,
    failedFeeds: result?.meta?.failedFeeds ?? null,
    itemsAfterTrim: result?.meta?.totalItemsAfterTrim ?? 0,
  };
}

function getTaMeta(result = {}) {
  return {
    ok: result?.ok === true,
    reason: result?.reason || null,
    marketChartReason: result?.fetchMeta?.marketChartReason || null,
    marketChartStatus: result?.fetchMeta?.marketChartStatus ?? null,
    pricesCount: result?.fetchMeta?.pricesCount ?? 0,
    branch: result?.sgView?.branch || null,
    status: result?.sgView?.status || null,
    readiness: result?.sgView?.readiness || null,
  };
}

function getMultiMeta(result = {}) {
  return {
    ok: result?.ok === true,
    reason: result?.reason || null,
    status: result?.sgView?.status || null,
    pricesCount: result?.pricesMeta?.itemsCount ?? 0,
    newsCount: result?.newsMeta?.totalItemsAfterTrim ?? 0,
    priceReason: result?.pricesMeta?.reason || null,
    newsReason: result?.newsMeta?.reason || null,
  };
}

function countHealthy(blocks = []) {
  return blocks.filter((x) => x?.ok === true).length;
}

function buildOverallStatus(blocks = []) {
  const healthy = countHealthy(blocks);
  if (healthy === blocks.length) return "full";
  if (healthy > 0) return "partial";
  return "down";
}

export async function readCryptoModuleDiagnostics(input = {}) {
  const ids = normalizeIds(input?.ids || getDefaultIds());
  const timeoutMs = normalizePositiveInt(input?.timeoutMs, 8000);
  const maxNews = normalizePositiveInt(input?.maxNews, 5);
  const days = normalizePositiveInt(input?.days, 30);
  const feedUrls = normalizeFeedUrls(input?.feedUrls || getDefaultFeedUrls());

  const [simplePriceResult, marketChartResult, newsResult, taResult, multiResult] =
    await Promise.all([
      fetchCoinGeckoSimplePrice({
        ids,
        vsCurrencies: ["usd"],
      }),
      fetchCoinGeckoMarketChart({
        coinId: ids[0] || "bitcoin",
        vsCurrency: "usd",
        days: String(days),
        timeoutMs,
        maxAttempts: 2,
        retryDelayMs: 700,
      }),
      fetchCryptoNewsRss({
        feedUrls,
        timeoutMs,
        maxItems: maxNews,
      }),
      readCoingeckoIndicatorsSnapshot({
        coinId: ids[0] || "bitcoin",
        vsCurrency: "usd",
        days: String(days),
        timeoutMs,
        maxAttempts: 2,
        retryDelayMs: 700,
      }),
      readCryptoMultiMonitorSnapshot({
        ids,
        maxNews,
        timeoutMs,
        feedUrls,
      }),
    ]);

  const simplePrice = getSimplePriceMeta(simplePriceResult);
  const marketChart = getMarketChartMeta(marketChartResult);
  const news = getNewsMeta(newsResult);
  const ta = getTaMeta(taResult);
  const multi = getMultiMeta(multiResult);

  const blocks = [simplePrice, marketChart, news, ta, multi];
  const overallStatus = buildOverallStatus(blocks);

  return {
    ok: true,
    sourceKey: "crypto_module_diagnostics",
    diagnosticsVersion: CRYPTO_MODULE_DIAGNOSTICS_VERSION,
    fetchedAt: new Date().toISOString(),
    request: {
      ids,
      timeoutMs,
      maxNews,
      days,
      feedUrls,
    },
    overall: {
      status: overallStatus,
      healthyBlocks: countHealthy(blocks),
      totalBlocks: blocks.length,
    },
    diagnostics: {
      simplePrice,
      marketChart,
      news,
      ta,
      multi,
    },
  };
}

export default {
  readCryptoModuleDiagnostics,
};