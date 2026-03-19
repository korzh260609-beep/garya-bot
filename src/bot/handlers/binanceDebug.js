// src/bot/handlers/binanceDebug.js
// ============================================================================
// STAGE 10D.1 — MONARCH/DEV BINANCE DEBUG HANDLER
// - /bn_ticker
// - /bn_ticker_full
//
// PURPOSE:
// - expose Binance 24hr ticker through SG dev commands
// - no SourceService changes
// - no chat runtime refactor
// - no AI interpretation here
// ============================================================================

import { fetchBinanceTicker24hr } from "../../sources/fetchBinanceTicker24hr.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;

  const out = Math.trunc(n);
  return out > 0 ? out : fallback;
}

function normalizeSymbol(value) {
  return normalizeString(value).toUpperCase() || "BTCUSDT";
}

function parseBinanceArgs(rest = "") {
  const raw = normalizeString(rest);

  if (!raw) {
    return {
      symbol: "BTCUSDT",
      timeoutMs: 8000,
    };
  }

  const parts = raw.split(/\s+/).filter(Boolean);

  return {
    symbol: normalizeSymbol(parts[0]),
    timeoutMs: normalizePositiveInt(parts[1], 8000),
  };
}

function getMode(cmd = "") {
  return cmd === "/bn_ticker_full" ? "full" : "short";
}

function getTitle(mode = "short") {
  return mode === "full" ? "🧪 BINANCE TICKER FULL" : "🧪 BINANCE TICKER";
}

function getDefaultCmd(mode = "short") {
  return mode === "full" ? "/bn_ticker_full" : "/bn_ticker";
}

function buildShortText(result = {}, input = {}) {
  const p = result?.meta?.parsed || {};

  return [
    getTitle("short"),
    `symbol: ${input.symbol}`,
    `timeout_ms: ${input.timeoutMs}`,
    "",
    `status: ${result?.ok === true ? "ready" : "not_ready"}`,
    `reason: ${result?.meta?.reason || "n/a"}`,
    `last_price: ${p?.lastPrice ?? "n/a"}`,
    `change_percent_24h: ${p?.priceChangePercent ?? "n/a"}`,
    `high_24h: ${p?.highPrice ?? "n/a"}`,
    `low_24h: ${p?.lowPrice ?? "n/a"}`,
    `volume_24h: ${p?.volume ?? "n/a"}`,
  ].join("\n");
}

function buildFullText(result = {}, input = {}) {
  const p = result?.meta?.parsed || {};

  return [
    getTitle("full"),
    `symbol: ${input.symbol}`,
    `timeout_ms: ${input.timeoutMs}`,
    "",
    `status: ${result?.ok === true ? "ready" : "not_ready"}`,
    `reason: ${result?.meta?.reason || "n/a"}`,
    `http_status: ${result?.meta?.status ?? "n/a"}`,
    `duration_ms: ${result?.meta?.durationMs ?? "n/a"}`,
    `url: ${result?.meta?.url || "n/a"}`,
    "",
    `last_price: ${p?.lastPrice ?? "n/a"}`,
    `price_change: ${p?.priceChange ?? "n/a"}`,
    `price_change_percent_24h: ${p?.priceChangePercent ?? "n/a"}`,
    `weighted_avg_price: ${p?.weightedAvgPrice ?? "n/a"}`,
    `open_price: ${p?.openPrice ?? "n/a"}`,
    `high_price: ${p?.highPrice ?? "n/a"}`,
    `low_price: ${p?.lowPrice ?? "n/a"}`,
    `last_qty: ${p?.lastQty ?? "n/a"}`,
    `base_volume_24h: ${p?.volume ?? "n/a"}`,
    `quote_volume_24h: ${p?.quoteVolume ?? "n/a"}`,
    `open_time: ${p?.openTime ?? "n/a"}`,
    `close_time: ${p?.closeTime ?? "n/a"}`,
    `first_trade_id: ${p?.firstId ?? "n/a"}`,
    `last_trade_id: ${p?.lastId ?? "n/a"}`,
    `trade_count: ${p?.count ?? "n/a"}`,
  ].join("\n");
}

function buildErrorText(result = {}, input = {}, mode = "short") {
  const lines = [
    getTitle(mode),
    `symbol: ${input.symbol}`,
    `timeout_ms: ${input.timeoutMs}`,
    `reason: ${result?.meta?.reason || "unknown_error"}`,
    `http_status: ${result?.meta?.status ?? "n/a"}`,
  ];

  if (mode === "full") {
    lines.push(`url: ${result?.meta?.url || "n/a"}`);
    lines.push(`raw_preview: ${result?.meta?.rawPreview || "n/a"}`);
    lines.push(`message: ${result?.meta?.message || "n/a"}`);
  }

  return lines.join("\n");
}

export async function handleBinanceDebug({
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
      handler: "binanceDebug",
      event: "forbidden",
      mode,
    });
    return { handled: true };
  }

  const input = parseBinanceArgs(rest);

  try {
    const result = await fetchBinanceTicker24hr(input);

    if (!result?.ok) {
      await reply(buildErrorText(result, input, mode), {
        cmd: cmd || defaultCmd,
        handler: "binanceDebug",
        event: "ticker_not_ready",
        mode,
      });
      return { handled: true };
    }

    const text =
      mode === "full"
        ? buildFullText(result, input)
        : buildShortText(result, input);

    await reply(text, {
      cmd: cmd || defaultCmd,
      handler: "binanceDebug",
      event: "ticker_ready",
      mode,
      symbol: input.symbol,
    });

    return { handled: true };
  } catch (error) {
    const text = [
      getTitle(mode),
      `symbol: ${input.symbol}`,
      `timeout_ms: ${input.timeoutMs}`,
      "reason: exception",
      `message: ${error?.message ? String(error.message) : "unknown_error"}`,
    ].join("\n");

    await reply(text, {
      cmd: cmd || defaultCmd,
      handler: "binanceDebug",
      event: "exception",
      mode,
    });

    return { handled: true };
  }
}

export default {
  handleBinanceDebug,
};