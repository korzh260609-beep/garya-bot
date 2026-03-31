// src/bot/handlers/okxDiagnosticsDebug.js
// ============================================================================
// STAGE 10D-alt.5 — MONARCH/DEV OKX DIAGNOSTICS DEBUG HANDLER
// - /okx_diag
// - /okx_diag_full
//
// PURPOSE:
// - run compact diagnostic pass over OKX ticker + candles + snapshot
// - keep diagnostics deterministic
// - no AI interpretation
// - no SourceService changes
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
  return cmd === "/okx_diag_full" ? "full" : "short";
}

function getTitle(mode = "short") {
  return mode === "full" ? "🧪 OKX DIAGNOSTICS FULL" : "🧪 OKX DIAGNOSTICS";
}

function getDefaultCmd(mode = "short") {
  return mode === "full" ? "/okx_diag_full" : "/okx_diag";
}

function buildDiagnosticBundle({ input, tickerResult, candlesResult, snapshotResult }) {
  const tickerOk = tickerResult?.ok === true;
  const candlesOk = candlesResult?.ok === true;
  const snapshotOk = snapshotResult?.ok === true;

  const overallOk = tickerOk && candlesOk && snapshotOk;

  return {
    ok: overallOk,
    reason: overallOk ? "okx_diag_ready" : "okx_diag_partial",
    input,
    ticker: {
      ok: tickerOk,
      reason: tickerResult?.meta?.reason || null,
      httpStatus: tickerResult?.meta?.status ?? null,
      durationMs: tickerResult?.meta?.durationMs ?? null,
      last: tickerResult?.meta?.parsed?.last ?? null,
      bidPx: tickerResult?.meta?.parsed?.bidPx ?? null,
      askPx: tickerResult?.meta?.parsed?.askPx ?? null,
    },
    candles: {
      ok: candlesOk,
      reason: candlesResult?.meta?.reason || null,
      httpStatus: candlesResult?.meta?.status ?? null,
      durationMs: candlesResult?.meta?.durationMs ?? null,
      count: candlesResult?.meta?.parsed?.count ?? 0,
      latestClose: candlesResult?.meta?.parsed?.latest?.close ?? null,
      latestTs: candlesResult?.meta?.parsed?.latest?.ts ?? null,
    },
    snapshot: {
      ok: snapshotOk,
      reason: snapshotResult?.reason || null,
      tickerOk: snapshotResult?.parts?.tickerOk === true,
      candlesOk: snapshotResult?.parts?.candlesOk === true,
      last: snapshotResult?.snapshot?.ticker?.last ?? null,
      latestClose: snapshotResult?.snapshot?.candles?.latestClose ?? null,
      closeChangePct: snapshotResult?.snapshot?.candles?.closeChangePct ?? null,
    },
  };
}

function buildShortText(bundle = {}) {
  return [
    getTitle("short"),
    `inst_id: ${bundle?.input?.instId || "n/a"}`,
    `bar: ${bundle?.input?.bar || "n/a"}`,
    `limit: ${bundle?.input?.limit ?? "n/a"}`,
    `timeout_ms: ${bundle?.input?.timeoutMs ?? "n/a"}`,
    "",
    `status: ${bundle?.ok === true ? "ready" : "partial"}`,
    `reason: ${bundle?.reason || "n/a"}`,
    `ticker_ok: ${bundle?.ticker?.ok === true ? "yes" : "no"}`,
    `candles_ok: ${bundle?.candles?.ok === true ? "yes" : "no"}`,
    `snapshot_ok: ${bundle?.snapshot?.ok === true ? "yes" : "no"}`,
    `last: ${bundle?.ticker?.last ?? "n/a"}`,
    `latest_close: ${bundle?.candles?.latestClose ?? "n/a"}`,
    `close_change_pct: ${bundle?.snapshot?.closeChangePct ?? "n/a"}`,
  ].join("\n");
}

function buildFullText(bundle = {}) {
  return [
    getTitle("full"),
    `inst_id: ${bundle?.input?.instId || "n/a"}`,
    `bar: ${bundle?.input?.bar || "n/a"}`,
    `limit: ${bundle?.input?.limit ?? "n/a"}`,
    `timeout_ms: ${bundle?.input?.timeoutMs ?? "n/a"}`,
    "",
    `status: ${bundle?.ok === true ? "ready" : "partial"}`,
    `reason: ${bundle?.reason || "n/a"}`,
    "",
    `ticker.ok: ${bundle?.ticker?.ok === true ? "yes" : "no"}`,
    `ticker.reason: ${bundle?.ticker?.reason || "n/a"}`,
    `ticker.http_status: ${bundle?.ticker?.httpStatus ?? "n/a"}`,
    `ticker.duration_ms: ${bundle?.ticker?.durationMs ?? "n/a"}`,
    `ticker.last: ${bundle?.ticker?.last ?? "n/a"}`,
    `ticker.bidPx: ${bundle?.ticker?.bidPx ?? "n/a"}`,
    `ticker.askPx: ${bundle?.ticker?.askPx ?? "n/a"}`,
    "",
    `candles.ok: ${bundle?.candles?.ok === true ? "yes" : "no"}`,
    `candles.reason: ${bundle?.candles?.reason || "n/a"}`,
    `candles.http_status: ${bundle?.candles?.httpStatus ?? "n/a"}`,
    `candles.duration_ms: ${bundle?.candles?.durationMs ?? "n/a"}`,
    `candles.count: ${bundle?.candles?.count ?? "n/a"}`,
    `candles.latest_close: ${bundle?.candles?.latestClose ?? "n/a"}`,
    `candles.latest_ts: ${bundle?.candles?.latestTs ?? "n/a"}`,
    "",
    `snapshot.ok: ${bundle?.snapshot?.ok === true ? "yes" : "no"}`,
    `snapshot.reason: ${bundle?.snapshot?.reason || "n/a"}`,
    `snapshot.ticker_ok: ${bundle?.snapshot?.tickerOk === true ? "yes" : "no"}`,
    `snapshot.candles_ok: ${bundle?.snapshot?.candlesOk === true ? "yes" : "no"}`,
    `snapshot.last: ${bundle?.snapshot?.last ?? "n/a"}`,
    `snapshot.latest_close: ${bundle?.snapshot?.latestClose ?? "n/a"}`,
    `snapshot.close_change_pct: ${bundle?.snapshot?.closeChangePct ?? "n/a"}`,
  ].join("\n");
}

export async function handleOkxDiagnosticsDebug({
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
      handler: "okxDiagnosticsDebug",
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

    const snapshotResult = buildOkxMarketSnapshot({
      instId: input.instId,
      bar: input.bar,
      tickerResult,
      candlesResult,
    });

    const bundle = buildDiagnosticBundle({
      input,
      tickerResult,
      candlesResult,
      snapshotResult,
    });

    const text =
      mode === "full"
        ? buildFullText(bundle)
        : buildShortText(bundle);

    await reply(text, {
      cmd: cmd || defaultCmd,
      handler: "okxDiagnosticsDebug",
      event: bundle?.ok === true ? "diag_ready" : "diag_partial",
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
      handler: "okxDiagnosticsDebug",
      event: "exception",
      mode,
    });

    return { handled: true };
  }
}

export default {
  handleOkxDiagnosticsDebug,
};