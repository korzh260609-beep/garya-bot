// src/bot/handlers/multiMonitorDebug.js
// ============================================================================
// STAGE 10C.9 — MONARCH/DEV MULTI-MONITOR DEBUG HANDLER
// - /multi_monitor
// - /multi_monitor_full
//
// PURPOSE:
// - combine price snapshot + news snapshot into one SG dev command
// - no SourceService changes
// - no chat runtime refactor
// - no AI interpretation here
// ============================================================================

import { readCryptoMultiMonitorSnapshot } from "../../sources/readCryptoMultiMonitorSnapshot.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;

  const out = Math.trunc(n);
  return out > 0 ? out : fallback;
}

function normalizeIdsFromCsv(value) {
  const raw = normalizeString(value);
  if (!raw) return [];

  const seen = new Set();
  const out = [];

  raw
    .split(",")
    .map((item) => normalizeString(item).toLowerCase())
    .filter(Boolean)
    .forEach((id) => {
      if (seen.has(id)) return;
      seen.add(id);
      out.push(id);
    });

  return out;
}

function getDefaultIds() {
  return ["bitcoin", "ethereum", "solana"];
}

function parseMultiMonitorArgs(rest = "") {
  const raw = normalizeString(rest);

  if (!raw) {
    return {
      ids: getDefaultIds(),
      maxNews: 5,
      timeoutMs: 8000,
    };
  }

  const parts = raw.split(/\s+/).filter(Boolean);

  const ids = normalizeIdsFromCsv(parts[0]);
  const maxNews = normalizePositiveInt(parts[1], 5);
  const timeoutMs = normalizePositiveInt(parts[2], 8000);

  return {
    ids: ids.length ? ids : getDefaultIds(),
    maxNews,
    timeoutMs,
  };
}

function getMode(cmd = "") {
  return cmd === "/multi_monitor_full" ? "full" : "short";
}

function getTitle(mode = "short") {
  return mode === "full" ? "🧪 MULTI MONITOR FULL" : "🧪 MULTI MONITOR";
}

function getDefaultCmd(mode = "short") {
  return mode === "full" ? "/multi_monitor_full" : "/multi_monitor";
}

function getPriceRows(result = {}) {
  return Array.isArray(result?.snapshot?.prices) ? result.snapshot.prices : [];
}

function getHeadlineRows(result = {}) {
  return Array.isArray(result?.snapshot?.headlines) ? result.snapshot.headlines : [];
}

function buildShortSuccessText(result = {}, input = {}) {
  const prices = getPriceRows(result);
  const headlines = getHeadlineRows(result);

  const lines = [
    getTitle("short"),
    `coins: ${Array.isArray(input.ids) ? input.ids.join(", ") : "n/a"}`,
    `max_news: ${input.maxNews}`,
    `timeout_ms: ${input.timeoutMs}`,
    "",
    `status: ${result?.sgView?.status || "n/a"}`,
    `prices: ${prices.length}`,
    `news: ${headlines.length}`,
    `price_reason: ${result?.pricesMeta?.reason || "n/a"}`,
    `news_reason: ${result?.newsMeta?.reason || "n/a"}`,
    "",
    "prices:",
  ];

  if (!prices.length) {
    lines.push("n/a");
  } else {
    prices.forEach((row, index) => {
      lines.push(
        `${index + 1}. ${row?.id || "n/a"} | price=${row?.price ?? "n/a"} | change_24h=${row?.change24h ?? "n/a"}`
      );
    });
  }

  lines.push("", "headlines:");

  if (!headlines.length) {
    lines.push("n/a");
  } else {
    headlines.forEach((item, index) => {
      lines.push(`${index + 1}. ${item?.title || "untitled"}`);
      lines.push(`   published: ${item?.publishedAt || "n/a"}`);
    });
  }

  return lines.join("\n");
}

function buildFullSuccessText(result = {}, input = {}) {
  const prices = getPriceRows(result);
  const headlines = getHeadlineRows(result);
  const feeds = Array.isArray(result?.newsMeta?.feeds) ? result.newsMeta.feeds : [];

  const lines = [
    getTitle("full"),
    `coins: ${Array.isArray(input.ids) ? input.ids.join(", ") : "n/a"}`,
    `max_news: ${input.maxNews}`,
    `timeout_ms: ${input.timeoutMs}`,
    "",
    `status: ${result?.sgView?.status || "n/a"}`,
    `reason: ${result?.reason || "n/a"}`,
    `short: ${result?.sgView?.shortText || "n/a"}`,
    `note: ${result?.sgView?.note || "n/a"}`,
    "",
    `prices_ok: ${result?.pricesMeta?.ok === true ? "true" : "false"}`,
    `prices_reason: ${result?.pricesMeta?.reason || "n/a"}`,
    `prices_status: ${result?.pricesMeta?.status ?? "n/a"}`,
    `prices_items: ${result?.pricesMeta?.itemsCount ?? "n/a"}`,
    `prices_duration_ms: ${result?.pricesMeta?.durationMs ?? "n/a"}`,
    "",
    `news_ok: ${result?.newsMeta?.ok === true ? "true" : "false"}`,
    `news_reason: ${result?.newsMeta?.reason || "n/a"}`,
    `news_total_feeds: ${result?.newsMeta?.totalFeeds ?? "n/a"}`,
    `news_successful_feeds: ${result?.newsMeta?.successfulFeeds ?? "n/a"}`,
    `news_failed_feeds: ${result?.newsMeta?.failedFeeds ?? "n/a"}`,
    `news_items_after_trim: ${result?.newsMeta?.totalItemsAfterTrim ?? "n/a"}`,
    "",
    "feeds_meta:",
  ];

  if (!feeds.length) {
    lines.push("n/a");
  } else {
    feeds.forEach((feed, index) => {
      lines.push(
        `${index + 1}. ok=${feed?.ok === true ? "true" : "false"} | items=${feed?.itemsCount ?? "n/a"} | reason=${feed?.reason || "n/a"} | status=${feed?.status ?? "n/a"}`
      );
      lines.push(`   url: ${feed?.url || "n/a"}`);
      lines.push(`   feed_type: ${feed?.feedType || "n/a"}`);
      lines.push(`   duration_ms: ${feed?.durationMs ?? "n/a"}`);
    });
  }

  lines.push("", "prices:");

  if (!prices.length) {
    lines.push("n/a");
  } else {
    prices.forEach((row, index) => {
      lines.push(`${index + 1}. ${row?.id || "n/a"}`);
      lines.push(`   price: ${row?.price ?? "n/a"}`);
      lines.push(`   market_cap: ${row?.marketCap ?? "n/a"}`);
      lines.push(`   volume_24h: ${row?.volume24h ?? "n/a"}`);
      lines.push(`   change_24h: ${row?.change24h ?? "n/a"}`);
      lines.push(`   last_updated_at: ${row?.lastUpdatedAt ?? "n/a"}`);
    });
  }

  lines.push("", "headlines:");

  if (!headlines.length) {
    lines.push("n/a");
  } else {
    headlines.forEach((item, index) => {
      lines.push(`${index + 1}. ${item?.title || "untitled"}`);
      lines.push(`   published_at: ${item?.publishedAt || "n/a"}`);
      lines.push(`   link: ${item?.link || "n/a"}`);
      lines.push(`   source_url: ${item?.sourceUrl || "n/a"}`);
      lines.push(`   feed_type: ${item?.feedType || "n/a"}`);
      lines.push(`   summary: ${item?.summary || "n/a"}`);
    });
  }

  return lines.join("\n");
}

function buildErrorText(result = {}, input = {}, mode = "short") {
  const lines = [
    getTitle(mode),
    `coins: ${Array.isArray(input.ids) ? input.ids.join(", ") : "n/a"}`,
    `max_news: ${input.maxNews}`,
    `timeout_ms: ${input.timeoutMs}`,
    `reason: ${result?.reason || "unknown_error"}`,
    `prices_reason: ${result?.pricesMeta?.reason || "n/a"}`,
    `news_reason: ${result?.newsMeta?.reason || "n/a"}`,
  ];

  if (mode === "full") {
    const feeds = Array.isArray(result?.newsMeta?.feeds) ? result.newsMeta.feeds : [];
    if (feeds.length) {
      lines.push("", "feeds_meta:");
      feeds.forEach((feed, index) => {
        lines.push(
          `${index + 1}. ok=${feed?.ok === true ? "true" : "false"} | items=${feed?.itemsCount ?? "n/a"} | reason=${feed?.reason || "n/a"} | status=${feed?.status ?? "n/a"}`
        );
        lines.push(`   url: ${feed?.url || "n/a"}`);
        lines.push(`   message: ${feed?.message || "n/a"}`);
      });
    }
  }

  return lines.join("\n");
}

export async function handleMultiMonitorDebug({
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
      handler: "multiMonitorDebug",
      event: "forbidden",
      mode,
    });
    return { handled: true };
  }

  const input = parseMultiMonitorArgs(rest);

  try {
    const result = await readCryptoMultiMonitorSnapshot(input);

    if (!result?.ok) {
      await reply(buildErrorText(result, input, mode), {
        cmd: cmd || defaultCmd,
        handler: "multiMonitorDebug",
        event: "multi_monitor_not_ready",
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
      handler: "multiMonitorDebug",
      event: "multi_monitor_ready",
      mode,
      status: result?.sgView?.status || null,
      prices: result?.pricesMeta?.itemsCount ?? null,
      news: result?.newsMeta?.totalItemsAfterTrim ?? null,
    });

    return { handled: true };
  } catch (error) {
    const text = [
      getTitle(mode),
      `coins: ${Array.isArray(input.ids) ? input.ids.join(", ") : "n/a"}`,
      `max_news: ${input.maxNews}`,
      `timeout_ms: ${input.timeoutMs}`,
      "reason: exception",
      `message: ${error?.message ? String(error.message) : "unknown_error"}`,
    ].join("\n");

    await reply(text, {
      cmd: cmd || defaultCmd,
      handler: "multiMonitorDebug",
      event: "exception",
      mode,
    });

    return { handled: true };
  }
}

export default {
  handleMultiMonitorDebug,
};