// src/bot/handlers/cryptoDiagnostics.js
// ============================================================================
// STAGE 10C.10 — MONARCH/DEV CRYPTO DIAGNOSTICS HANDLER
// - /crypto_diag
// - /crypto_diag_full
// ============================================================================

import { readCryptoModuleDiagnostics } from "../../sources/readCryptoModuleDiagnostics.js";

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
  return ["bitcoin", "ethereum"];
}

function parseDiagArgs(rest = "") {
  const raw = normalizeString(rest);

  if (!raw) {
    return {
      ids: getDefaultIds(),
      maxNews: 5,
      timeoutMs: 8000,
      days: 30,
    };
  }

  const parts = raw.split(/\s+/).filter(Boolean);

  return {
    ids: normalizeIdsFromCsv(parts[0]).length
      ? normalizeIdsFromCsv(parts[0])
      : getDefaultIds(),
    maxNews: normalizePositiveInt(parts[1], 5),
    timeoutMs: normalizePositiveInt(parts[2], 8000),
    days: normalizePositiveInt(parts[3], 30),
  };
}

function getMode(cmd = "") {
  return cmd === "/crypto_diag_full" ? "full" : "short";
}

function getTitle(mode = "short") {
  return mode === "full" ? "🧪 CRYPTO DIAGNOSTICS FULL" : "🧪 CRYPTO DIAGNOSTICS";
}

function getDefaultCmd(mode = "short") {
  return mode === "full" ? "/crypto_diag_full" : "/crypto_diag";
}

function buildShortText(result = {}, input = {}) {
  const d = result?.diagnostics || {};

  return [
    getTitle("short"),
    `coins: ${Array.isArray(input.ids) ? input.ids.join(", ") : "n/a"}`,
    `max_news: ${input.maxNews}`,
    `timeout_ms: ${input.timeoutMs}`,
    `days: ${input.days}`,
    "",
    `overall_status: ${result?.overall?.status || "n/a"}`,
    `healthy_blocks: ${result?.overall?.healthyBlocks ?? "n/a"}/${result?.overall?.totalBlocks ?? "n/a"}`,
    "",
    `simple_price: ${d.simplePrice?.ok === true ? "ok" : "fail"} | ${d.simplePrice?.reason || "n/a"}`,
    `market_chart: ${d.marketChart?.ok === true ? "ok" : "fail"} | ${d.marketChart?.reason || "n/a"}`,
    `news: ${d.news?.ok === true ? "ok" : "fail"} | ${d.news?.reason || "n/a"}`,
    `ta: ${d.ta?.ok === true ? "ok" : "fail"} | ${d.ta?.reason || "n/a"}`,
    `multi: ${d.multi?.ok === true ? "ok" : "fail"} | ${d.multi?.reason || "n/a"}`,
  ].join("\n");
}

function buildFullText(result = {}, input = {}) {
  const d = result?.diagnostics || {};

  return [
    getTitle("full"),
    `coins: ${Array.isArray(input.ids) ? input.ids.join(", ") : "n/a"}`,
    `max_news: ${input.maxNews}`,
    `timeout_ms: ${input.timeoutMs}`,
    `days: ${input.days}`,
    "",
    `overall_status: ${result?.overall?.status || "n/a"}`,
    `healthy_blocks: ${result?.overall?.healthyBlocks ?? "n/a"}`,
    `total_blocks: ${result?.overall?.totalBlocks ?? "n/a"}`,
    "",
    `simple_price_ok: ${d.simplePrice?.ok === true ? "true" : "false"}`,
    `simple_price_reason: ${d.simplePrice?.reason || "n/a"}`,
    `simple_price_status: ${d.simplePrice?.status ?? "n/a"}`,
    `simple_price_duration_ms: ${d.simplePrice?.durationMs ?? "n/a"}`,
    `simple_price_parsed_count: ${d.simplePrice?.parsedCount ?? "n/a"}`,
    "",
    `market_chart_ok: ${d.marketChart?.ok === true ? "true" : "false"}`,
    `market_chart_reason: ${d.marketChart?.reason || "n/a"}`,
    `market_chart_status: ${d.marketChart?.status ?? "n/a"}`,
    `market_chart_duration_ms: ${d.marketChart?.durationMs ?? "n/a"}`,
    `market_chart_prices_count: ${d.marketChart?.pricesCount ?? "n/a"}`,
    `market_chart_interval_used: ${d.marketChart?.intervalUsed || "auto"}`,
    `market_chart_fallback_used: ${d.marketChart?.fallbackUsed === true ? "true" : "false"}`,
    "",
    `news_ok: ${d.news?.ok === true ? "true" : "false"}`,
    `news_reason: ${d.news?.reason || "n/a"}`,
    `news_total_feeds: ${d.news?.totalFeeds ?? "n/a"}`,
    `news_successful_feeds: ${d.news?.successfulFeeds ?? "n/a"}`,
    `news_failed_feeds: ${d.news?.failedFeeds ?? "n/a"}`,
    `news_items_after_trim: ${d.news?.itemsAfterTrim ?? "n/a"}`,
    "",
    `ta_ok: ${d.ta?.ok === true ? "true" : "false"}`,
    `ta_reason: ${d.ta?.reason || "n/a"}`,
    `ta_market_chart_reason: ${d.ta?.marketChartReason || "n/a"}`,
    `ta_market_chart_status: ${d.ta?.marketChartStatus ?? "n/a"}`,
    `ta_prices_count: ${d.ta?.pricesCount ?? "n/a"}`,
    `ta_branch: ${d.ta?.branch || "n/a"}`,
    `ta_status: ${d.ta?.status || "n/a"}`,
    `ta_readiness: ${d.ta?.readiness || "n/a"}`,
    "",
    `multi_ok: ${d.multi?.ok === true ? "true" : "false"}`,
    `multi_reason: ${d.multi?.reason || "n/a"}`,
    `multi_status: ${d.multi?.status || "n/a"}`,
    `multi_prices_count: ${d.multi?.pricesCount ?? "n/a"}`,
    `multi_news_count: ${d.multi?.newsCount ?? "n/a"}`,
    `multi_price_reason: ${d.multi?.priceReason || "n/a"}`,
    `multi_news_reason: ${d.multi?.newsReason || "n/a"}`,
  ].join("\n");
}

export async function handleCryptoDiagnostics({
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
      handler: "cryptoDiagnostics",
      event: "forbidden",
      mode,
    });
    return { handled: true };
  }

  const input = parseDiagArgs(rest);

  try {
    const result = await readCryptoModuleDiagnostics(input);
    const text = mode === "full" ? buildFullText(result, input) : buildShortText(result, input);

    await reply(text, {
      cmd: cmd || defaultCmd,
      handler: "cryptoDiagnostics",
      event: "diagnostics_ready",
      mode,
      overallStatus: result?.overall?.status || null,
    });

    return { handled: true };
  } catch (error) {
    await reply(
      [
        getTitle(mode),
        `coins: ${Array.isArray(input.ids) ? input.ids.join(", ") : "n/a"}`,
        `max_news: ${input.maxNews}`,
        `timeout_ms: ${input.timeoutMs}`,
        `days: ${input.days}`,
        "reason: exception",
        `message: ${error?.message ? String(error.message) : "unknown_error"}`,
      ].join("\n"),
      {
        cmd: cmd || defaultCmd,
        handler: "cryptoDiagnostics",
        event: "exception",
        mode,
      }
    );

    return { handled: true };
  }
}

export default {
  handleCryptoDiagnostics,
};