// src/sources/fetchCryptoNewsRss.js
// ============================================================================
// STAGE 10C.8 — Crypto News RSS fetcher (isolated skeleton)
// PURPOSE:
// - first isolated news source for Stage 10C.8
// - fetch RSS/Atom feeds without chat wiring
// - keep network logic OUT of handlers
// - normalize headline list into deterministic source output
//
// IMPORTANT:
// - this module is fetcher-only
// - no SourceService changes
// - no command wiring yet
// - no AI interpretation here
// - fail-open behavior stays in caller layer
// - feed parsing is intentionally simple and dependency-free
// ============================================================================

import { fetchWithTimeout } from "../core/fetchWithTimeout.js";

export const CRYPTO_NEWS_RSS_VERSION = "10C.8-news-skeleton-v1";

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_ITEMS = 10;

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;

  const out = Math.trunc(n);
  return out > 0 ? out : fallback;
}

function normalizeUrlArray(value) {
  if (!Array.isArray(value)) return [];

  const unique = new Set();
  const out = [];

  for (const item of value) {
    const url = normalizeString(item);

    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    if (unique.has(url)) continue;

    unique.add(url);
    out.push(url);
  }

  return out;
}

function decodeXmlEntities(value) {
  const text = normalizeString(value);
  if (!text) return "";

  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function stripHtml(value) {
  return decodeXmlEntities(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractTag(block, tagName) {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = re.exec(block);
  return match ? match[1] : "";
}

function extractAtomLink(block) {
  const match = /<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i.exec(block);
  return match ? match[1] : "";
}

function safeTimestamp(value) {
  const text = normalizeString(value);
  if (!text) return null;

  const ts = Date.parse(text);
  return Number.isFinite(ts) ? ts : null;
}

function parseRssItems(xmlText, sourceUrl) {
  const out = [];
  const itemMatches = xmlText.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  for (const block of itemMatches) {
    const title = stripHtml(extractTag(block, "title"));
    const link = normalizeString(decodeXmlEntities(extractTag(block, "link")));
    const pubDateRaw = normalizeString(decodeXmlEntities(extractTag(block, "pubDate")));
    const description = stripHtml(extractTag(block, "description"));

    if (!title && !link) continue;

    out.push({
      title: title || "untitled",
      link: link || null,
      publishedAt: pubDateRaw || null,
      publishedTs: safeTimestamp(pubDateRaw),
      summary: description || null,
      sourceUrl,
      feedType: "rss",
    });
  }

  return out;
}

function parseAtomEntries(xmlText, sourceUrl) {
  const out = [];
  const entryMatches = xmlText.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];

  for (const block of entryMatches) {
    const title = stripHtml(extractTag(block, "title"));
    const link = normalizeString(decodeXmlEntities(extractAtomLink(block)));
    const publishedRaw =
      normalizeString(decodeXmlEntities(extractTag(block, "published"))) ||
      normalizeString(decodeXmlEntities(extractTag(block, "updated")));
    const summary =
      stripHtml(extractTag(block, "summary")) ||
      stripHtml(extractTag(block, "content"));

    if (!title && !link) continue;

    out.push({
      title: title || "untitled",
      link: link || null,
      publishedAt: publishedRaw || null,
      publishedTs: safeTimestamp(publishedRaw),
      summary: summary || null,
      sourceUrl,
      feedType: "atom",
    });
  }

  return out;
}

function dedupeNewsItems(items = []) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const key = `${normalizeString(item?.title).toLowerCase()}|${normalizeString(item?.link).toLowerCase()}`;
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(item);
  }

  return out;
}

function sortNewsItems(items = []) {
  return [...items].sort((a, b) => {
    const aTs = typeof a?.publishedTs === "number" ? a.publishedTs : -1;
    const bTs = typeof b?.publishedTs === "number" ? b.publishedTs : -1;
    return bTs - aTs;
  });
}

function buildContentText(items = []) {
  if (!Array.isArray(items) || !items.length) return "";

  const lines = [];

  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.title || "untitled"}`);
    lines.push(`   published_at: ${item.publishedAt || "n/a"}`);
    lines.push(`   link: ${item.link || "n/a"}`);

    if (item.summary) {
      lines.push(`   summary: ${item.summary}`);
    }

    lines.push(`   feed_type: ${item.feedType || "unknown"}`);
    lines.push(`   source_url: ${item.sourceUrl || "n/a"}`);
  });

  return lines.join("\n");
}

function buildHeaders() {
  return {
    accept: "application/rss+xml, application/xml, text/xml, application/atom+xml, text/plain;q=0.8, */*;q=0.5",
    "user-agent": "SG-GARYA/10C-news-rss (+Render; source-only)",
  };
}

async function fetchOneFeed(url, timeoutMs) {
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

    if (!response.ok) {
      return {
        ok: false,
        url,
        status: response.status,
        statusText: response.statusText || "",
        durationMs,
        rawPreview: typeof rawText === "string" ? rawText.slice(0, 500) : "",
        items: [],
        feedType: null,
        reason: "http_error",
      };
    }

    const rssItems = parseRssItems(rawText, url);
    const atomItems = parseAtomEntries(rawText, url);
    const merged = rssItems.length ? rssItems : atomItems;
    const feedType = rssItems.length ? "rss" : atomItems.length ? "atom" : "unknown";

    return {
      ok: merged.length > 0,
      url,
      status: response.status,
      statusText: response.statusText || "",
      durationMs,
      rawPreview: typeof rawText === "string" ? rawText.slice(0, 500) : "",
      items: merged,
      feedType,
      reason: merged.length > 0 ? "parsed_ok" : "parsed_empty",
    };
  } catch (error) {
    return {
      ok: false,
      url,
      status: null,
      statusText: "",
      durationMs: Date.now() - startedAt,
      rawPreview: "",
      items: [],
      feedType: null,
      reason: "network_error",
      message: error?.message ? String(error.message) : "unknown_error",
    };
  }
}

export async function fetchCryptoNewsRss(input = {}) {
  const feedUrls = normalizeUrlArray(input?.feedUrls || []);
  const timeoutMs = normalizePositiveInt(input?.timeoutMs, DEFAULT_TIMEOUT_MS);
  const maxItems = normalizePositiveInt(input?.maxItems, DEFAULT_MAX_ITEMS);

  if (!feedUrls.length) {
    return {
      ok: false,
      sourceKey: "crypto_news_rss",
      content: "",
      fetchedAt: new Date().toISOString(),
      meta: {
        version: CRYPTO_NEWS_RSS_VERSION,
        reason: "missing_feed_urls",
      },
    };
  }

  const feedResults = [];
  let allItems = [];

  for (const url of feedUrls) {
    const result = await fetchOneFeed(url, timeoutMs);
    feedResults.push({
      url: result.url,
      ok: result.ok,
      reason: result.reason,
      status: result.status,
      statusText: result.statusText,
      durationMs: result.durationMs,
      feedType: result.feedType,
      itemsCount: Array.isArray(result.items) ? result.items.length : 0,
      message: result.message || null,
      rawPreview: result.rawPreview || "",
    });

    if (Array.isArray(result.items) && result.items.length) {
      allItems = allItems.concat(result.items);
    }
  }

  const parsedItems = sortNewsItems(dedupeNewsItems(allItems)).slice(0, maxItems);
  const content = buildContentText(parsedItems);

  return {
    ok: parsedItems.length > 0,
    sourceKey: "crypto_news_rss",
    content,
    fetchedAt: new Date().toISOString(),
    meta: {
      version: CRYPTO_NEWS_RSS_VERSION,
      reason: parsedItems.length > 0 ? "news_ready" : "news_empty",
      feedUrls,
      timeoutMs,
      maxItems,
      totalFeeds: feedUrls.length,
      successfulFeeds: feedResults.filter((x) => x.ok).length,
      failedFeeds: feedResults.filter((x) => !x.ok).length,
      totalItemsBeforeTrim: allItems.length,
      totalItemsAfterTrim: parsedItems.length,
      feeds: feedResults,
      parsed: {
        items: parsedItems,
      },
    },
  };
}

export default {
  fetchCryptoNewsRss,
};