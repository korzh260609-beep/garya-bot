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

function buildShortText(result = {}, input = {}) {
  const fused = result?.fused || {};
  const price = fused?.price || {};
  const ta = fused?.ta || {};
  const news = fused?.news || {};

  return [
    getTitle("short"),
    `coin: ${input.coinId}`,
    `vs: ${input.vsCurrency}`,
    `days: ${input.days}`,
    `max_news: ${input.maxNews}`,
    `timeout_ms: ${input.timeoutMs}`,
    "",
    `status: ${result?.overall?.status || "n/a"}`,
    `healthy_blocks: ${result?.overall?.healthyBlocks ?? "n/a"}/${result?.overall?.totalBlocks ?? "n/a"}`,
    "",
    `price: ${typeof price?.price === "number" ? price.price : "n/a"}`,
    `change_24h: ${price?.change24h ?? "n/a"}`,
    `ta_signal: ${ta?.signal || "n/a"}`,
    `ta_trigger: ${ta?.triggerStatus || "n/a"}`,
    `ta_readiness: ${ta?.readinessLabel || "n/a"}`,
    `news_items: ${news?.itemsAfterTrim ?? "n/a"}`,
    "",
    `short: ${result?.sgView?.shortText || "n/a"}`,
    `note: ${result?.sgView?.note || "n/a"}`,
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
    `status: ${result?.overall?.status || "n/a"}`,
    `healthy_blocks: ${result?.overall?.healthyBlocks ?? "n/a"}`,
    `total_blocks: ${result?.overall?.totalBlocks ?? "n/a"}`,
    "",
    `price_ok: ${price?.ok === true ? "true" : "false"}`,
    `price_reason: ${price?.reason || "n/a"}`,
    `price_status: ${price?.status ?? "n/a"}`,
    `price_duration_ms: ${price?.durationMs ?? "n/a"}`,
    `price_value: ${price?.price ?? "n/a"}`,
    `price_market_cap: ${price?.marketCap ?? "n/a"}`,
    `price_volume_24h: ${price?.volume24h ?? "n/a"}`,
    `price_change_24h: ${price?.change24h ?? "n/a"}`,
    `price_last_updated_at: ${price?.lastUpdatedAt ?? "n/a"}`,
    "",
    `ta_ok: ${ta?.ok === true ? "true" : "false"}`,
    `ta_reason: ${ta?.reason || "n/a"}`,
    `ta_market_chart_reason: ${ta?.marketChartReason || "n/a"}`,
    `ta_market_chart_status: ${ta?.marketChartStatus ?? "n/a"}`,
    `ta_prices_count: ${ta?.pricesCount ?? "n/a"}`,
    `ta_signal: ${ta?.signal || "n/a"}`,
    `ta_confidence: ${ta?.confidence || "n/a"}`,
    `ta_trigger_status: ${ta?.triggerStatus || "n/a"}`,
    `ta_readiness_label: ${ta?.readinessLabel || "n/a"}`,
    `ta_readiness_score: ${ta?.readinessScore ?? "n/a"}`,
    `ta_bias: ${ta?.bias || "n/a"}`,
    `ta_hint: ${ta?.hint || "n/a"}`,
    `ta_branch: ${ta?.branch || "n/a"}`,
    `ta_status: ${ta?.status || "n/a"}`,
    `ta_readiness: ${ta?.readiness || "n/a"}`,
    `ta_interval_used: ${ta?.intervalUsed || "auto"}`,
    `ta_fallback_used: ${ta?.fallbackUsed === true ? "true" : "false"}`,
    `ta_summary_line: ${ta?.summaryLine || "n/a"}`,
    `ta_short_text: ${ta?.shortText || "n/a"}`,
    `ta_note: ${ta?.note || "n/a"}`,
    "",
    `news_ok: ${news?.ok === true ? "true" : "false"}`,
    `news_reason: ${news?.reason || "n/a"}`,
    `news_total_feeds: ${news?.totalFeeds ?? "n/a"}`,
    `news_successful_feeds: ${news?.successfulFeeds ?? "n/a"}`,
    `news_failed_feeds: ${news?.failedFeeds ?? "n/a"}`,
    `news_items_after_trim: ${news?.itemsAfterTrim ?? "n/a"}`,
    "",
    "headlines:",
  ];

  if (!headlines.length) {
    lines.push("n/a");
  } else {
    headlines.forEach((item, index) => {
      lines.push(`${index + 1}. ${item?.title || "untitled"}`);
      lines.push(`   published_at: ${item?.publishedAt || "n/a"}`);
      lines.push(`   link: ${item?.link || "n/a"}`);
      lines.push(`   source_url: ${item?.sourceUrl || "n/a"}`);
      lines.push(`   feed_type: ${item?.feedType || "n/a"}`);
    });
  }

  lines.push(
    "",
    `short: ${result?.sgView?.shortText || "n/a"}`,
    `note: ${result?.sgView?.note || "n/a"}`
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