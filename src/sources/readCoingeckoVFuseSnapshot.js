// src/sources/readCoingeckoVFuseSnapshot.js
// ============================================================================
// STAGE 10C.11 — CG V-FUSE SNAPSHOT (isolated)
// PURPOSE:
// - fuse CoinGecko price + TA snapshot + crypto RSS into one SG dev snapshot
// - keep this layer source-only and deterministic
// - no SourceService changes
// - no chat wiring
// - no execution logic
//
// IMPORTANT:
// - this is a lightweight fusion layer
// - diagnostics module is intentionally NOT called here
//   because it would duplicate network requests and increase 429 risk
// - fail-open behavior stays honest: full / partial / down
// ============================================================================

import { fetchCoinGeckoSimplePrice } from "./fetchCoingeckoSimplePrice.js";
import { readCoingeckoIndicatorsSnapshot } from "./readCoingeckoIndicatorsSnapshot.js";
import { fetchCryptoNewsRss } from "./fetchCryptoNewsRss.js";

export const COINGECKO_V_FUSE_SNAPSHOT_VERSION = "10C.11-cg-v-fuse-v1";

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

function getDefaultFeedUrls() {
  return [
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://cointelegraph.com/rss",
  ];
}

function getPriceMeta(result = {}, coinId = "bitcoin", vsCurrency = "usd") {
  const parsed = result?.meta?.parsed?.[coinId]?.[vsCurrency] || {};
  const lastUpdatedAt = result?.meta?.parsed?.[coinId]?.lastUpdatedAt ?? null;

  return {
    ok: result?.ok === true,
    reason: result?.meta?.reason || null,
    status: result?.meta?.status ?? null,
    durationMs: result?.meta?.durationMs ?? null,
    price: typeof parsed?.price === "number" ? parsed.price : null,
    marketCap: typeof parsed?.marketCap === "number" ? parsed.marketCap : null,
    volume24h: typeof parsed?.volume24h === "number" ? parsed.volume24h : null,
    change24h: typeof parsed?.change24h === "number" ? parsed.change24h : null,
    lastUpdatedAt:
      typeof lastUpdatedAt === "number" ? lastUpdatedAt : null,
  };
}

function getTaMeta(result = {}) {
  return {
    ok: result?.ok === true,
    reason: result?.reason || null,
    marketChartReason: result?.fetchMeta?.marketChartReason || null,
    marketChartStatus: result?.fetchMeta?.marketChartStatus ?? null,
    pricesCount: result?.fetchMeta?.pricesCount ?? 0,
    signal: result?.snapshot?.signal || null,
    confidence: result?.snapshot?.confidence || null,
    triggerStatus: result?.snapshot?.triggerStatus || null,
    readinessLabel: result?.snapshot?.readinessLabel || null,
    readinessScore:
      typeof result?.snapshot?.readinessScore === "number"
        ? result.snapshot.readinessScore
        : null,
    bias: result?.snapshot?.bias || null,
    hint: result?.snapshot?.hint || null,
    summaryLine: result?.snapshot?.summaryLine || null,
    shortText: result?.sgView?.shortText || null,
    note: result?.sgView?.note || null,
    branch: result?.sgView?.branch || null,
    status: result?.sgView?.status || null,
    readiness: result?.sgView?.readiness || null,
    intervalUsed: result?.fetchMeta?.intervalUsed || null,
    fallbackUsed: result?.fetchMeta?.fallbackUsed === true,
  };
}

function getNewsMeta(result = {}, maxNews = 5) {
  const items = Array.isArray(result?.meta?.parsed?.items)
    ? result.meta.parsed.items
    : [];

  return {
    ok: result?.ok === true,
    reason: result?.meta?.reason || null,
    totalFeeds: result?.meta?.totalFeeds ?? null,
    successfulFeeds: result?.meta?.successfulFeeds ?? null,
    failedFeeds: result?.meta?.failedFeeds ?? null,
    itemsAfterTrim: result?.meta?.totalItemsAfterTrim ?? 0,
    headlines: items.slice(0, maxNews).map((item) => ({
      title: item?.title || "untitled",
      publishedAt: item?.publishedAt || null,
      link: item?.link || null,
      sourceUrl: item?.sourceUrl || null,
      feedType: item?.feedType || null,
    })),
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

function buildHeadlineNote(news = {}) {
  const headlines = Array.isArray(news?.headlines) ? news.headlines : [];
  if (!headlines.length) return "News headlines are limited right now.";
  return `${headlines.length} headline(s) available from RSS.`;
}

function buildFusedShortText({ overallStatus, price, ta, news }) {
  const priceText =
    typeof price?.price === "number" ? String(price.price) : "n/a";

  const signalText = ta?.signal || "n/a";
  const taStatusText = ta?.status || "n/a";
  const newsCount = news?.itemsAfterTrim ?? 0;

  if (overallStatus === "full") {
    return `Price=${priceText}, TA=${signalText}/${taStatusText}, news=${newsCount}.`;
  }

  if (overallStatus === "partial") {
    return `Partial fuse: price=${priceText}, TA=${signalText}/${taStatusText}, news=${newsCount}.`;
  }

  return "Fuse snapshot is down right now.";
}

function buildFusedNote({ overallStatus, ta, news }) {
  if (overallStatus === "full") {
    return ta?.note || "Fused crypto snapshot is ready.";
  }

  if (overallStatus === "partial") {
    return [
      ta?.note || null,
      buildHeadlineNote(news),
      "Some source blocks are degraded, but the snapshot is still usable.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return "All fused source blocks are unavailable right now.";
}

export async function readCoingeckoVFuseSnapshot(input = {}) {
  const normalizedInput = {
    coinId: normalizeCoinId(input?.coinId),
    vsCurrency: normalizeVsCurrency(input?.vsCurrency),
    days: normalizeDays(input?.days),
    maxNews: normalizePositiveInt(input?.maxNews, 5),
    timeoutMs: normalizePositiveInt(input?.timeoutMs, 8000),
    emaPeriod: normalizePositiveInt(input?.emaPeriod, 20),
    emaSlowPeriod: normalizePositiveInt(input?.emaSlowPeriod, 50),
    rsiPeriod: normalizePositiveInt(input?.rsiPeriod, 14),
    maxAttempts: normalizePositiveInt(input?.maxAttempts, 2),
    retryDelayMs: normalizePositiveInt(input?.retryDelayMs, 700),
    feedUrls: normalizeFeedUrls(input?.feedUrls || getDefaultFeedUrls()),
  };

  const [priceResult, taResult, newsResult] = await Promise.all([
    fetchCoinGeckoSimplePrice({
      ids: [normalizedInput.coinId],
      vsCurrencies: [normalizedInput.vsCurrency],
    }),
    readCoingeckoIndicatorsSnapshot({
      coinId: normalizedInput.coinId,
      vsCurrency: normalizedInput.vsCurrency,
      days: normalizedInput.days,
      emaPeriod: normalizedInput.emaPeriod,
      emaSlowPeriod: normalizedInput.emaSlowPeriod,
      rsiPeriod: normalizedInput.rsiPeriod,
      timeoutMs: normalizedInput.timeoutMs,
      maxAttempts: normalizedInput.maxAttempts,
      retryDelayMs: normalizedInput.retryDelayMs,
    }),
    fetchCryptoNewsRss({
      feedUrls: normalizedInput.feedUrls,
      timeoutMs: normalizedInput.timeoutMs,
      maxItems: normalizedInput.maxNews,
    }),
  ]);

  const price = getPriceMeta(
    priceResult,
    normalizedInput.coinId,
    normalizedInput.vsCurrency
  );
  const ta = getTaMeta(taResult);
  const news = getNewsMeta(newsResult, normalizedInput.maxNews);

  const blocks = [price, ta, news];
  const overallStatus = buildOverallStatus(blocks);
  const healthyBlocks = countHealthy(blocks);

  return {
    ok: overallStatus !== "down",
    sourceKey: "coingecko_v_fuse_snapshot",
    snapshotVersion: COINGECKO_V_FUSE_SNAPSHOT_VERSION,
    fetchedAt: new Date().toISOString(),
    request: {
      coinId: normalizedInput.coinId,
      vsCurrency: normalizedInput.vsCurrency,
      days: normalizedInput.days,
      maxNews: normalizedInput.maxNews,
      timeoutMs: normalizedInput.timeoutMs,
      emaPeriod: normalizedInput.emaPeriod,
      emaSlowPeriod: normalizedInput.emaSlowPeriod,
      rsiPeriod: normalizedInput.rsiPeriod,
      maxAttempts: normalizedInput.maxAttempts,
      retryDelayMs: normalizedInput.retryDelayMs,
      feedUrls: normalizedInput.feedUrls,
    },
    overall: {
      status: overallStatus,
      healthyBlocks,
      totalBlocks: blocks.length,
    },
    fused: {
      price,
      ta,
      news,
    },
    sgView: {
      status: overallStatus,
      shortText: buildFusedShortText({
        overallStatus,
        price,
        ta,
        news,
      }),
      note: buildFusedNote({
        overallStatus,
        ta,
        news,
      }),
    },
  };
}

export default {
  readCoingeckoVFuseSnapshot,
};