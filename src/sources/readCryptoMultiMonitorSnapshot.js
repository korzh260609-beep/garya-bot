// src/sources/readCryptoMultiMonitorSnapshot.js
// ============================================================================
// STAGE 10C.9 — CRYPTO MULTI-MONITOR SNAPSHOT (isolated)
// PURPOSE:
// - combine simple price snapshot + crypto news snapshot
// - keep this layer source-only and deterministic
// - no SourceService changes
// - no chat wiring
// - no AI interpretation here
// ============================================================================

import { fetchCoinGeckoSimplePrice } from "./fetchCoingeckoSimplePrice.js";
import { fetchCryptoNewsRss } from "./fetchCryptoNewsRss.js";

export const CRYPTO_MULTI_MONITOR_SNAPSHOT_VERSION = "10C.9-multi-monitor-v1";

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
  return ["bitcoin", "ethereum", "solana"];
}

function getDefaultFeedUrls() {
  return [
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://cointelegraph.com/rss",
  ];
}

function buildPriceRows(priceResult, ids) {
  const parsed = priceResult?.meta?.parsed;
  const rows = [];

  for (const id of ids) {
    const block = parsed?.[id];
    if (!block || typeof block !== "object") continue;

    const usd = block.usd || {};

    rows.push({
      id,
      price: typeof usd.price === "number" ? usd.price : null,
      marketCap: typeof usd.marketCap === "number" ? usd.marketCap : null,
      volume24h: typeof usd.volume24h === "number" ? usd.volume24h : null,
      change24h: typeof usd.change24h === "number" ? usd.change24h : null,
      lastUpdatedAt:
        typeof block.lastUpdatedAt === "number" ? block.lastUpdatedAt : null,
    });
  }

  return rows;
}

function buildHeadlineRows(newsResult, maxNews) {
  const items = Array.isArray(newsResult?.meta?.parsed?.items)
    ? newsResult.meta.parsed.items
    : [];

  return items.slice(0, maxNews).map((item) => ({
    title: item?.title || "untitled",
    publishedAt: item?.publishedAt || null,
    link: item?.link || null,
    sourceUrl: item?.sourceUrl || null,
    feedType: item?.feedType || null,
    summary: item?.summary || null,
  }));
}

function buildNotReadyResult(reason, extra = {}) {
  return {
    ok: false,
    sourceKey: "crypto_multi_monitor_snapshot",
    snapshotVersion: CRYPTO_MULTI_MONITOR_SNAPSHOT_VERSION,
    reason,
    fetchedAt: new Date().toISOString(),
    request: {
      ids: Array.isArray(extra.ids) ? extra.ids : [],
      maxNews: extra.maxNews ?? null,
      timeoutMs: extra.timeoutMs ?? null,
      feedUrls: Array.isArray(extra.feedUrls) ? extra.feedUrls : [],
    },
    pricesMeta: extra.pricesMeta || {},
    newsMeta: extra.newsMeta || {},
    snapshot: {
      prices: [],
      headlines: [],
    },
    sgView: {
      status: "not_ready",
      shortText: null,
      note: null,
    },
  };
}

function buildReadyResult({
  ids,
  maxNews,
  timeoutMs,
  feedUrls,
  priceResult,
  newsResult,
}) {
  const prices = buildPriceRows(priceResult, ids);
  const headlines = buildHeadlineRows(newsResult, maxNews);

  const pricesOk = prices.length > 0;
  const newsOk = headlines.length > 0;

  const status = pricesOk && newsOk ? "full" : "partial";
  const shortText =
    pricesOk && newsOk
      ? "Prices and news are both available."
      : pricesOk
        ? "Prices are available, news is limited."
        : "News is available, prices are limited.";

  const note =
    pricesOk && newsOk
      ? "Multi-monitor snapshot is ready."
      : "Snapshot is partial but still useful for diagnostics.";

  return {
    ok: true,
    sourceKey: "crypto_multi_monitor_snapshot",
    snapshotVersion: CRYPTO_MULTI_MONITOR_SNAPSHOT_VERSION,
    reason: status === "full" ? "multi_monitor_ready" : "multi_monitor_partial_ready",
    fetchedAt: new Date().toISOString(),
    request: {
      ids,
      maxNews,
      timeoutMs,
      feedUrls,
    },
    pricesMeta: {
      ok: priceResult?.ok === true,
      reason: priceResult?.meta?.reason || null,
      status: priceResult?.meta?.status ?? null,
      durationMs: priceResult?.meta?.durationMs ?? null,
      idsRequested: ids,
      itemsCount: prices.length,
      url: priceResult?.meta?.url || null,
      rawPreview: priceResult?.meta?.rawPreview || null,
    },
    newsMeta: {
      ok: newsResult?.ok === true,
      reason: newsResult?.meta?.reason || null,
      totalFeeds: newsResult?.meta?.totalFeeds ?? null,
      successfulFeeds: newsResult?.meta?.successfulFeeds ?? null,
      failedFeeds: newsResult?.meta?.failedFeeds ?? null,
      totalItemsBeforeTrim: newsResult?.meta?.totalItemsBeforeTrim ?? null,
      totalItemsAfterTrim: newsResult?.meta?.totalItemsAfterTrim ?? null,
      feeds: Array.isArray(newsResult?.meta?.feeds) ? newsResult.meta.feeds : [],
    },
    snapshot: {
      prices,
      headlines,
    },
    sgView: {
      status,
      shortText,
      note,
    },
  };
}

export async function readCryptoMultiMonitorSnapshot(input = {}) {
  const ids = normalizeIds(input?.ids || getDefaultIds());
  const maxNews = normalizePositiveInt(input?.maxNews, 5);
  const timeoutMs = normalizePositiveInt(input?.timeoutMs, 8000);
  const feedUrls = normalizeFeedUrls(input?.feedUrls || getDefaultFeedUrls());

  if (!ids.length) {
    return buildNotReadyResult("missing_ids", {
      ids,
      maxNews,
      timeoutMs,
      feedUrls,
    });
  }

  if (!feedUrls.length) {
    return buildNotReadyResult("missing_feed_urls", {
      ids,
      maxNews,
      timeoutMs,
      feedUrls,
    });
  }

  const [priceResult, newsResult] = await Promise.all([
    fetchCoinGeckoSimplePrice({
      ids,
      vsCurrencies: ["usd"],
    }),
    fetchCryptoNewsRss({
      feedUrls,
      timeoutMs,
      maxItems: maxNews,
    }),
  ]);

  const hasPrices =
    Array.isArray(buildPriceRows(priceResult, ids)) &&
    buildPriceRows(priceResult, ids).length > 0;
  const hasNews =
    Array.isArray(buildHeadlineRows(newsResult, maxNews)) &&
    buildHeadlineRows(newsResult, maxNews).length > 0;

  if (!hasPrices && !hasNews) {
    return buildNotReadyResult("multi_monitor_not_ready", {
      ids,
      maxNews,
      timeoutMs,
      feedUrls,
      pricesMeta: {
        ok: priceResult?.ok === true,
        reason: priceResult?.meta?.reason || null,
        status: priceResult?.meta?.status ?? null,
        durationMs: priceResult?.meta?.durationMs ?? null,
        url: priceResult?.meta?.url || null,
        rawPreview: priceResult?.meta?.rawPreview || null,
      },
      newsMeta: {
        ok: newsResult?.ok === true,
        reason: newsResult?.meta?.reason || null,
        totalFeeds: newsResult?.meta?.totalFeeds ?? null,
        successfulFeeds: newsResult?.meta?.successfulFeeds ?? null,
        failedFeeds: newsResult?.meta?.failedFeeds ?? null,
        feeds: Array.isArray(newsResult?.meta?.feeds) ? newsResult.meta.feeds : [],
      },
    });
  }

  return buildReadyResult({
    ids,
    maxNews,
    timeoutMs,
    feedUrls,
    priceResult,
    newsResult,
  });
}

export default {
  readCryptoMultiMonitorSnapshot,
};