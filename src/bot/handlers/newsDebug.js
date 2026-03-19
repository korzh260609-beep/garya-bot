// src/bot/handlers/newsDebug.js
// ============================================================================
// STAGE 10C.8 — MONARCH/DEV NEWS DEBUG HANDLER
// - /news_rss
// - /news_rss_full
//
// PURPOSE:
// - let SG read crypto news RSS through isolated source layer
// - short variant returns compact SG-friendly news view
// - full variant returns expanded technical/source view
// - no SourceService changes
// - no chat runtime refactor
// - no AI interpretation here
// ============================================================================

import { fetchCryptoNewsRss } from "../../sources/fetchCryptoNewsRss.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;

  const out = Math.trunc(n);
  return out > 0 ? out : fallback;
}

function normalizeFeedUrls(value) {
  if (!Array.isArray(value)) return [];

  const out = [];
  const seen = new Set();

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

function parseNewsArgs(rest = "") {
  const raw = normalizeString(rest);

  if (!raw) {
    return {
      maxItems: 5,
      timeoutMs: 8000,
      feedUrls: getDefaultFeedUrls(),
    };
  }

  const parts = raw.split(/\s+/).filter(Boolean);

  const maxItems = normalizePositiveInt(parts[0], 5);
  const timeoutMs = normalizePositiveInt(parts[1], 8000);
  const feedUrls = normalizeFeedUrls(parts.slice(2));

  return {
    maxItems,
    timeoutMs,
    feedUrls: feedUrls.length ? feedUrls : getDefaultFeedUrls(),
  };
}

function getMode(cmd = "") {
  return cmd === "/news_rss_full" ? "full" : "short";
}

function getTitle(mode = "short") {
  return mode === "full" ? "🧪 NEWS RSS FULL" : "🧪 NEWS RSS";
}

function getDefaultCmd(mode = "short") {
  return mode === "full" ? "/news_rss_full" : "/news_rss";
}

function getParsedItems(result = {}) {
  return Array.isArray(result?.meta?.parsed?.items) ? result.meta.parsed.items : [];
}

function buildShortSuccessText(result = {}, input = {}) {
  const items = getParsedItems(result).slice(0, input.maxItems);
  const totalItems = result?.meta?.totalItemsAfterTrim ?? items.length;
  const successfulFeeds = result?.meta?.successfulFeeds ?? "n/a";
  const failedFeeds = result?.meta?.failedFeeds ?? "n/a";

  const lines = [
    getTitle("short"),
    `feeds: ${Array.isArray(input.feedUrls) ? input.feedUrls.length : 0}`,
    `max_items: ${input.maxItems}`,
    `timeout_ms: ${input.timeoutMs}`,
    "",
    `status: ready`,
    `items: ${totalItems}`,
    `successful_feeds: ${successfulFeeds}`,
    `failed_feeds: ${failedFeeds}`,
    "",
  ];

  if (!items.length) {
    lines.push("news: empty");
    return lines.join("\n");
  }

  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item?.title || "untitled"}`);
    lines.push(`   published: ${item?.publishedAt || "n/a"}`);
    lines.push(`   source: ${item?.sourceUrl || "n/a"}`);
  });

  return lines.join("\n");
}

function buildFullSuccessText(result = {}, input = {}) {
  const items = getParsedItems(result);
  const feedMeta = Array.isArray(result?.meta?.feeds) ? result.meta.feeds : [];

  const lines = [
    getTitle("full"),
    `feeds: ${Array.isArray(input.feedUrls) ? input.feedUrls.length : 0}`,
    `max_items: ${input.maxItems}`,
    `timeout_ms: ${input.timeoutMs}`,
    "",
    `status: ready`,
    `reason: ${result?.meta?.reason || "n/a"}`,
    `successful_feeds: ${result?.meta?.successfulFeeds ?? "n/a"}`,
    `failed_feeds: ${result?.meta?.failedFeeds ?? "n/a"}`,
    `total_items_before_trim: ${result?.meta?.totalItemsBeforeTrim ?? "n/a"}`,
    `total_items_after_trim: ${result?.meta?.totalItemsAfterTrim ?? "n/a"}`,
    "",
    "feeds_meta:",
  ];

  if (!feedMeta.length) {
    lines.push("n/a");
  } else {
    feedMeta.forEach((feed, index) => {
      lines.push(
        `${index + 1}. ok=${feed?.ok === true ? "true" : "false"} | items=${feed?.itemsCount ?? "n/a"} | reason=${feed?.reason || "n/a"} | status=${feed?.status ?? "n/a"}`
      );
      lines.push(`   url: ${feed?.url || "n/a"}`);
      lines.push(`   feed_type: ${feed?.feedType || "n/a"}`);
      lines.push(`   duration_ms: ${feed?.durationMs ?? "n/a"}`);
    });
  }

  lines.push("", "items:");

  if (!items.length) {
    lines.push("n/a");
    return lines.join("\n");
  }

  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item?.title || "untitled"}`);
    lines.push(`   published_at: ${item?.publishedAt || "n/a"}`);
    lines.push(`   link: ${item?.link || "n/a"}`);
    lines.push(`   feed_type: ${item?.feedType || "n/a"}`);
    lines.push(`   source_url: ${item?.sourceUrl || "n/a"}`);
    lines.push(`   summary: ${item?.summary || "n/a"}`);
  });

  return lines.join("\n");
}

function buildErrorText(result = {}, input = {}, mode = "short") {
  const lines = [
    getTitle(mode),
    `feeds: ${Array.isArray(input.feedUrls) ? input.feedUrls.length : 0}`,
    `max_items: ${input.maxItems}`,
    `timeout_ms: ${input.timeoutMs}`,
    `reason: ${result?.meta?.reason || "unknown_error"}`,
    `successful_feeds: ${result?.meta?.successfulFeeds ?? "n/a"}`,
    `failed_feeds: ${result?.meta?.failedFeeds ?? "n/a"}`,
  ];

  const feedMeta = Array.isArray(result?.meta?.feeds) ? result.meta.feeds : [];

  if (mode === "full" && feedMeta.length) {
    lines.push("", "feeds_meta:");
    feedMeta.forEach((feed, index) => {
      lines.push(
        `${index + 1}. ok=${feed?.ok === true ? "true" : "false"} | items=${feed?.itemsCount ?? "n/a"} | reason=${feed?.reason || "n/a"} | status=${feed?.status ?? "n/a"}`
      );
      lines.push(`   url: ${feed?.url || "n/a"}`);
      lines.push(`   message: ${feed?.message || "n/a"}`);
      lines.push(`   raw_preview: ${feed?.rawPreview || "n/a"}`);
    });
  }

  return lines.join("\n");
}

export async function handleNewsDebug({
  bot,
  chatId,
  rest,
  reply,
  bypass,
  cmd,
}) {
  const mode = getMode(cmd);
  const defaultCmd = getDefaultCmd(mode);

  if (!bypass) {
    await reply("⛔ DEV only.", {
      cmd: cmd || defaultCmd,
      handler: "newsDebug",
      event: "forbidden",
      mode,
    });
    return { handled: true };
  }

  const input = parseNewsArgs(rest);

  try {
    const result = await fetchCryptoNewsRss(input);

    if (!result?.ok) {
      await reply(buildErrorText(result, input, mode), {
        cmd: cmd || defaultCmd,
        handler: "newsDebug",
        event: "news_not_ready",
        mode,
      });
      return { handled: true };
    }

    const text =
      mode === "full"
        ? buildFullSuccessText(result, input)
        : buildShortSuccessText(result, input);

    await reply(text, {
      cmd: cmd || defaultCmd,
      handler: "newsDebug",
      event: "news_ready",
      mode,
      items: result?.meta?.totalItemsAfterTrim ?? null,
      successfulFeeds: result?.meta?.successfulFeeds ?? null,
      failedFeeds: result?.meta?.failedFeeds ?? null,
    });

    return { handled: true };
  } catch (error) {
    const text = [
      getTitle(mode),
      `feeds: ${Array.isArray(input.feedUrls) ? input.feedUrls.length : 0}`,
      `max_items: ${input.maxItems}`,
      `timeout_ms: ${input.timeoutMs}`,
      "reason: exception",
      `message: ${error?.message ? String(error.message) : "unknown_error"}`,
    ].join("\n");

    await reply(text, {
      cmd: cmd || defaultCmd,
      handler: "newsDebug",
      event: "exception",
      mode,
    });

    return { handled: true };
  }
}

export default {
  handleNewsDebug,
};