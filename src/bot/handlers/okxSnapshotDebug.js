// src/bot/handlers/okxSnapshotDebug.js
// ============================================================================
// STAGE 10D-alt.4 — MONARCH/DEV OKX SNAPSHOT DEBUG HANDLER
// - /okx_snapshot
// - /okx_snapshot_full
//
// PURPOSE:
// - combine OKX ticker + candles into one debug snapshot
// - no AI interpretation
// - no chat runtime refactor
// ============================================================================

import { fetchOkxTicker } from "../../sources/fetchOkxTicker.js";
import { fetchOkxCandles } from "../../sources/fetchOkxCandles.js";
import { buildOkxMarketSnapshot } from "../../sources/buildOkxMarketSnapshot.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePositiveInt(value, fallback, min = 1, max = 300) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;

  const out = Math.trunc(n);
  if (out < min) return min;
  if (out > max) return max;
  return out;
}

function normalizeInstId(value) {
  return normalizeString(value).toUpperCase() || "BTC-USDT";
}

function normalizeBar(value) {
  return normalizeString(value) || "1H";
}

function parseArgs(rest = "") {
  const raw = normalizeString(rest);

  if (!raw) {
    return {
      instId: "BTC-USDT",
      bar: "1H",
      limit: 100,
      timeoutMs: 8000,
    };
  }

  const parts = raw.split(/\s+/).filter(Boolean);

  return {
    instId: normalizeInstId(parts[0]),
    bar: normalizeBar(parts[1]),
    limit: normalizePositiveInt(parts[2], 100, 1, 300),
    timeoutMs: normalizePositiveInt(parts[3], 8000, 1000, 60000),
  };
}

function getMode(cmd = "") {
  return cmd === "/okx_snapshot_full" ? "full" : "short";
}

function getTitle(mode = "short") {
  return mode === "full" ? "🧪 OKX SNAPSHOT FULL" : "🧪 OKX SNAPSHOT";
}

function getDefaultCmd(mode = "short") {
  return mode === "full" ? "/okx_snapshot_full" : "/okx_snapshot";
}

function buildShortText(result = {}, input = {}) {
  const s = result?.snapshot || {};

  return [
    getTitle("short"),
    `inst_id: ${input.instId}`,
    `bar: ${input.bar}`,
    `limit: ${input.limit}`,
    `timeout_ms: ${input.timeoutMs}`,
    "",
    `status: ${result?.ok === true ? "ready" : "partial"}`,
    `reason: ${result?.reason || "n/a"}`,
    `ticker_ok: ${s?.ticker?.ok === true ? "yes" : "no"}`,
    `candles_ok: ${s?.candles?.ok === true ? "yes" : "no"}`,
    `last: ${s?.ticker?.last ?? "n/a"}`,
    `bid: ${s?.ticker?.bidPx ?? "n/a"}`,
    `ask: ${s?.ticker?.askPx ?? "n/a"}`,
    `candles_count: ${s?.candles?.count ?? "n/a"}`,
    `latest_close: ${s?.candles?.latestClose ?? "n/a"}`,
    `range_high: ${s?.candles?.rangeHigh ?? "n/a"}`,
    `range_low: ${s?.candles?.rangeLow ?? "n/a"}`,
    `close_change_pct: ${s?.candles?.closeChangePct ?? "n/a"}`,
  ].join("\n");
}

function buildFullText(result = {}, input = {}) {
  const s = result?.snapshot || {};
  const p = result?.parts || {};

  return [
    getTitle("full"),
    `inst_id: ${input.instId}`,
    `bar: ${input.bar}`,
    `limit: ${input.limit}`,
    `timeout_ms: ${input.timeoutMs}`,
    "",
    `status: ${result?.ok === true ? "ready" : "partial"}`,
    `reason: ${result?.reason || "n/a"}`,
    `ticker_ok: ${p?.tickerOk === true ? "yes" : "no"}`,
    `candles_ok: ${p?.candlesOk === true ? "yes" : "no"}`,
    `ticker_reason: ${p?.tickerReason || "n/a"}`,
    `candles_reason: ${p?.candlesReason || "n/a"}`,
    "",
    `ticker.last: ${s?.ticker?.last ?? "n/a"}`,
    `ticker.bidPx: ${s?.ticker?.bidPx ?? "n/a"}`,
    `ticker.askPx: ${s?.ticker?.askPx ?? "n/a"}`,
    `ticker.open24h: ${s?.ticker?.open24h ?? "n/a"}`,
    `ticker.high24h: ${s?.ticker?.high24h ?? "n/a"}`,
    `ticker.low24h: ${s?.ticker?.low24h ?? "n/a"}`,
    `ticker.vol24h: ${s?.ticker?.vol24h ?? "n/a"}`,
    `ticker.ts: ${s?.ticker?.ts ?? "n/a"}`,
    `ticker.ts_iso: ${s?.ticker?.tsIso || "n/a"}`,
    "",
    `candles.count: ${s?.candles?.count ?? "n/a"}`,
    `candles.latest_ts: ${s?.candles?.latestTs ?? "n/a"}`,
    `candles.latest_ts_iso: ${s?.candles?.latestTsIso || "n/a"}`,
    `candles.latest_open: ${s?.candles?.latestOpen ?? "n/a"}`,
    `candles.latest_high: ${s?.candles?.latestHigh ?? "n/a"}`,
    `candles.latest_low: ${s?.candles?.latestLow ?? "n/a"}`,
    `candles.latest_close: ${s?.candles?.latestClose ?? "n/a"}`,
    `candles.latest_volume: ${s?.candles?.latestVolume ?? "n/a"}`,
    `candles.oldest_ts: ${s?.candles?.oldestTs ?? "n/a"}`,
    `candles.oldest_ts_iso: ${s?.candles?.oldestTsIso || "n/a"}`,
    `candles.range_high: ${s?.candles?.rangeHigh ?? "n/a"}`,
    `candles.range_low: ${s?.candles?.rangeLow ?? "n/a"}`,
    `candles.close_change_pct: ${s?.candles?.closeChangePct ?? "n/a"}`,
  ].join("\n");
}

export async function handleOkxSnapshotDebug({
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
      handler: "okxSnapshotDebug",
      event: "forbidden",
      mode,
    });
    return { handled: true };
  }

  const input = parseArgs(rest);

  try {
    const [tickerResult, candlesResult] = await Promise.all([
      fetchOkxTicker({
        instId: input.instId,
        timeoutMs: input.timeoutMs,
      }),
      fetchOkxCandles({
        instId: input.instId,
        bar: input.bar,
        limit: input.limit,
        timeoutMs: input.timeoutMs,
      }),
    ]);

    const result = buildOkxMarketSnapshot({
      instId: input.instId,
      bar: input.bar,
      tickerResult,
      candlesResult,
    });

    const text =
      mode === "full"
        ? buildFullText(result, input)
        : buildShortText(result, input);

    await reply(text, {
      cmd: cmd || defaultCmd,
      handler: "okxSnapshotDebug",
      event: result?.ok === true ? "snapshot_ready" : "snapshot_partial",
      mode,
      instId: input.instId,
      bar: input.bar,
    });

    return { handled: true };
  } catch (error) {
    const text = [
      getTitle(mode),
      `inst_id: ${input.instId}`,
      `bar: ${input.bar}`,
      `limit: ${input.limit}`,
      `timeout_ms: ${input.timeoutMs}`,
      "reason: exception",
      `message: ${error?.message ? String(error.message) : "unknown_error"}`,
    ].join("\n");

    await reply(text, {
      cmd: cmd || defaultCmd,
      handler: "okxSnapshotDebug",
      event: "exception",
      mode,
    });

    return { handled: true };
  }
}

export default {
  handleOkxSnapshotDebug,
};