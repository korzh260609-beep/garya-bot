// src/bot/handlers/cgVFuse.js
// ============================================================================
// STAGE 10C.11 — MONARCH/DEV CG V-FUSE HANDLER
// - /cg_vfuse
// - /cg_vfuse_full
//
// PURPOSE:
// - expose fused price + TA + news snapshot through SG dev commands
// - no SourceService changes
// - no chat runtime refactor
// - no execution logic
// ============================================================================

import { readCoingeckoVFuseSnapshot } from "../../sources/readCoingeckoVFuseSnapshot.js";

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

function parseVFuseArgs(rest = "") {
  const raw = normalizeString(rest);

  if (!raw) {
    return {
      coinId: "bitcoin",
      vsCurrency: "usd",
      days: "30",
      maxNews: 5,
      timeoutMs: 8000,
    };
  }

  const parts = raw.split(/\s+/).filter(Boolean);

  return {
    coinId: normalizeCoinId(parts[0]),
    vsCurrency: normalizeVsCurrency(parts[1] || "usd"),
    days: normalizeDays(parts[2] || "30"),
    maxNews: normalizePositiveInt(parts[3], 5),
    timeoutMs: normalizePositiveInt(parts[4], 8000),
  };
}

function getMode(cmd = "") {
  return cmd === "/cg_vfuse_full" ? "full" : "short";
}

function getTitle(mode = "short") {
  return mode === "full" ? "🧪 CG V-FUSE FULL" : "🧪 CG V-FUSE";
}

function getDefaultCmd(mode = "short") {
  return mode === "full" ? "/cg_vfuse_full" : "/cg_vfuse";
}

function toReadableValue(value, fallback = "unavailable") {
  if (value === null || value === undefined) return fallback;
  if (value === "") return fallback;
  return String(value);
}

function toReadableBool(value) {
  return value === true ? "true" : "false";
}

function toReadableBlockState(ok) {
  return ok === true ? "ok" : "degraded";
}

function toIsoFromUnixSeconds(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "unavailable";

  try {
    return new Date(value * 1000).toISOString();
  } catch (_) {
    return "unavailable";
  }
}

function buildShortText(result = {}, input = {}) {
  const fused = result?.fused || {};
  const price = fused?.price || {};
  const ta = fused?.ta || {};
  const news = fused?.news || {};

  const priceValue =
    typeof price?.price === "number" ? price.price : "unavailable";

  const change24h =
    typeof price?.change24h === "number" ? price.change24h : "unavailable";

  const taSignal = ta?.signal || "unavailable";
  const taTrigger = ta?.triggerStatus || "unavailable";
  const taReadiness = ta?.readinessLabel || "unavailable";
  const newsItems = news?.itemsAfterTrim ?? "unavailable";

  return [
    getTitle("short"),
    `coin: ${input.coinId}`,
    `vs: ${input.vsCurrency}`,
    `days: ${input.days}`,
    `max_news: ${input.maxNews}`,
    `timeout_ms: ${input.timeoutMs}`,
    "",
    `status: ${result?.overall?.status || "unavailable"}`,
    `healthy_blocks: ${result?.overall?.healthyBlocks ?? "unavailable"}/${result?.overall?.totalBlocks ?? "unavailable"}`,
    `price_block: ${toReadableBlockState(price?.ok)}`,
    `ta_block: ${toReadableBlockState(ta?.ok)}`,
    `news_block: ${toReadableBlockState(news?.ok)}`,
    "",
    `price: ${priceValue}`,
    `change_24h: ${change24h}`,
    `ta_signal: ${taSignal}`,
    `ta_trigger: ${taTrigger}`,
    `ta_readiness: ${taReadiness}`,
    `news_items: ${newsItems}`,
    "",
    `short: ${result?.sgView?.shortText || "unavailable"}`,
    `note: ${result?.sgView?.note || "unavailable"}`,
  ].join("\n");
}

function buildFullText(result = {}, input = {}) {
  const fused = result?.fused || {};
  const price = fused?.price || {};
  const ta = fused?.ta || {};
  const news = fused?.news || {};
  const headlines = Array.isArray(news?.headlines) ? news.headlines : [];

  const lines = [
    getTitle("full"),
    `coin: ${input.coinId}`,
    `vs: ${input.vsCurrency}`,
    `days: ${input.days}`,
    `max_news: ${input.maxNews}`,
    `timeout_ms: ${input.timeoutMs}`,
    "",
    `status: ${result?.overall?.status || "unavailable"}`,
    `healthy_blocks: ${result?.overall?.healthyBlocks ?? "unavailable"}`,
    `total_blocks: ${result?.overall?.totalBlocks ?? "unavailable"}`,
    `price_block: ${toReadableBlockState(price?.ok)}`,
    `ta_block: ${toReadableBlockState(ta?.ok)}`,
    `news_block: ${toReadableBlockState(news?.ok)}`,
    "",
    `price_ok: ${toReadableBool(price?.ok === true)}`,
    `price_reason: ${toReadableValue(price?.reason)}`,
    `price_status: ${toReadableValue(price?.status)}`,
    `price_duration_ms: ${toReadableValue(price?.durationMs)}`,
    `price_value: ${toReadableValue(price?.price)}`,
    `price_market_cap: ${toReadableValue(price?.marketCap)}`,
    `price_volume_24h: ${toReadableValue(price?.volume24h)}`,
    `price_change_24h: ${toReadableValue(price?.change24h)}`,
    `price_last_updated_at: ${toReadableValue(price?.lastUpdatedAt)}`,
    `price_last_update_iso: ${toIsoFromUnixSeconds(price?.lastUpdatedAt)}`,
    "",
    `ta_ok: ${toReadableBool(ta?.ok === true)}`,
    `ta_reason: ${toReadableValue(ta?.reason)}`,
    `ta_market_chart_reason: ${toReadableValue(ta?.marketChartReason)}`,
    `ta_market_chart_status: ${toReadableValue(ta?.marketChartStatus)}`,
    `ta_prices_count: ${toReadableValue(ta?.pricesCount)}`,
    `ta_signal: ${toReadableValue(ta?.signal)}`,
    `ta_confidence: ${toReadableValue(ta?.confidence)}`,
    `ta_trigger_status: ${toReadableValue(ta?.triggerStatus)}`,
    `ta_readiness_label: ${toReadableValue(ta?.readinessLabel)}`,
    `ta_readiness_score: ${toReadableValue(ta?.readinessScore)}`,
    `ta_bias: ${toReadableValue(ta?.bias)}`,
    `ta_hint: ${toReadableValue(ta?.hint)}`,
    `ta_branch: ${toReadableValue(ta?.branch)}`,
    `ta_status: ${toReadableValue(ta?.status)}`,
    `ta_readiness: ${toReadableValue(ta?.readiness)}`,
    `ta_interval_used: ${toReadableValue(ta?.intervalUsed, "auto")}`,
    `ta_fallback_used: ${toReadableBool(ta?.fallbackUsed === true)}`,
    `ta_summary_line: ${toReadableValue(ta?.summaryLine)}`,
    `ta_short_text: ${toReadableValue(ta?.shortText)}`,
    `ta_note: ${toReadableValue(ta?.note)}`,
    "",
    `news_ok: ${toReadableBool(news?.ok === true)}`,
    `news_reason: ${toReadableValue(news?.reason)}`,
    `news_total_feeds: ${toReadableValue(news?.totalFeeds)}`,
    `news_successful_feeds: ${toReadableValue(news?.successfulFeeds)}`,
    `news_failed_feeds: ${toReadableValue(news?.failedFeeds)}`,
    `news_items_after_trim: ${toReadableValue(news?.itemsAfterTrim)}`,
    "",
    "headlines:",
  ];

  if (!headlines.length) {
    lines.push("unavailable");
  } else {
    headlines.forEach((item, index) => {
      lines.push(`${index + 1}. ${item?.title || "untitled"}`);
      lines.push(`   published_at: ${item?.publishedAt || "unavailable"}`);
      lines.push(`   link: ${item?.link || "unavailable"}`);
      lines.push(`   source_url: ${item?.sourceUrl || "unavailable"}`);
      lines.push(`   feed_type: ${item?.feedType || "unavailable"}`);
    });
  }

  lines.push(
    "",
    `short: ${result?.sgView?.shortText || "unavailable"}`,
    `note: ${result?.sgView?.note || "unavailable"}`
  );

  return lines.join("\n");
}

export async function handleCgVFuse({
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
      handler: "cgVFuse",
      event: "forbidden",
      mode,
    });
    return { handled: true };
  }

  const input = parseVFuseArgs(rest);

  try {
    const result = await readCoingeckoVFuseSnapshot(input);
    const text =
      mode === "full" ? buildFullText(result, input) : buildShortText(result, input);

    await reply(text, {
      cmd: cmd || defaultCmd,
      handler: "cgVFuse",
      event: "vfuse_ready",
      mode,
      overallStatus: result?.overall?.status || null,
    });

    return { handled: true };
  } catch (error) {
    await reply(
      [
        getTitle(mode),
        `coin: ${input.coinId}`,
        `vs: ${input.vsCurrency}`,
        `days: ${input.days}`,
        `max_news: ${input.maxNews}`,
        `timeout_ms: ${input.timeoutMs}`,
        "reason: exception",
        `message: ${error?.message ? String(error.message) : "unknown_error"}`,
      ].join("\n"),
      {
        cmd: cmd || defaultCmd,
        handler: "cgVFuse",
        event: "exception",
        mode,
      }
    );

    return { handled: true };
  }
}

export default {
  handleCgVFuse,
};