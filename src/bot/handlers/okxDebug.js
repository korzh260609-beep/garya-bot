// src/bot/handlers/okxDebug.js
// ============================================================================
// STAGE 10D-alt.1 — MONARCH/DEV OKX DEBUG HANDLER
// - /okx_ticker
// - /okx_ticker_full
//
// PURPOSE:
// - expose OKX ticker through SG dev commands
// - no SourceService changes
// - no chat runtime refactor
// - no AI interpretation here
// ============================================================================

import { fetchOkxTicker } from "../../sources/fetchOkxTicker.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;

  const out = Math.trunc(n);
  return out > 0 ? out : fallback;
}

function normalizeInstId(value) {
  return normalizeString(value).toUpperCase() || "BTC-USDT";
}

function parseOkxArgs(rest = "") {
  const raw = normalizeString(rest);

  if (!raw) {
    return {
      instId: "BTC-USDT",
      timeoutMs: 8000,
    };
  }

  const parts = raw.split(/\s+/).filter(Boolean);

  return {
    instId: normalizeInstId(parts[0]),
    timeoutMs: normalizePositiveInt(parts[1], 8000),
  };
}

function getMode(cmd = "") {
  return cmd === "/okx_ticker_full" ? "full" : "short";
}

function getTitle(mode = "short") {
  return mode === "full" ? "🧪 OKX TICKER FULL" : "🧪 OKX TICKER";
}

function getDefaultCmd(mode = "short") {
  return mode === "full" ? "/okx_ticker_full" : "/okx_ticker";
}

function buildShortText(result = {}, input = {}) {
  const p = result?.meta?.parsed || {};

  const open24h = typeof p?.open24h === "number" ? p.open24h : null;
  const last = typeof p?.last === "number" ? p.last : null;
  let change24hPercent = null;

  if (
    typeof last === "number" &&
    typeof open24h === "number" &&
    open24h !== 0
  ) {
    change24hPercent = ((last - open24h) / open24h) * 100;
  }

  return [
    getTitle("short"),
    `inst_id: ${input.instId}`,
    `timeout_ms: ${input.timeoutMs}`,
    "",
    `status: ${result?.ok === true ? "ready" : "not_ready"}`,
    `reason: ${result?.meta?.reason || "n/a"}`,
    `last: ${p?.last ?? "n/a"}`,
    `bid: ${p?.bidPx ?? "n/a"}`,
    `ask: ${p?.askPx ?? "n/a"}`,
    `change_percent_24h: ${change24hPercent ?? "n/a"}`,
    `high_24h: ${p?.high24h ?? "n/a"}`,
    `low_24h: ${p?.low24h ?? "n/a"}`,
    `volume_24h: ${p?.vol24h ?? "n/a"}`,
  ].join("\n");
}

function buildFullText(result = {}, input = {}) {
  const p = result?.meta?.parsed || {};

  return [
    getTitle("full"),
    `inst_id: ${input.instId}`,
    `timeout_ms: ${input.timeoutMs}`,
    "",
    `status: ${result?.ok === true ? "ready" : "not_ready"}`,
    `reason: ${result?.meta?.reason || "n/a"}`,
    `http_status: ${result?.meta?.status ?? "n/a"}`,
    `duration_ms: ${result?.meta?.durationMs ?? "n/a"}`,
    `url: ${result?.meta?.url || "n/a"}`,
    `api_code: ${result?.meta?.apiCode ?? "n/a"}`,
    `api_msg: ${result?.meta?.apiMsg || "n/a"}`,
    "",
    `inst_type: ${p?.instType ?? "n/a"}`,
    `last: ${p?.last ?? "n/a"}`,
    `last_size: ${p?.lastSz ?? "n/a"}`,
    `ask_px: ${p?.askPx ?? "n/a"}`,
    `ask_sz: ${p?.askSz ?? "n/a"}`,
    `bid_px: ${p?.bidPx ?? "n/a"}`,
    `bid_sz: ${p?.bidSz ?? "n/a"}`,
    `open_24h: ${p?.open24h ?? "n/a"}`,
    `high_24h: ${p?.high24h ?? "n/a"}`,
    `low_24h: ${p?.low24h ?? "n/a"}`,
    `vol_24h: ${p?.vol24h ?? "n/a"}`,
    `vol_ccy_24h: ${p?.volCcy24h ?? "n/a"}`,
    `sod_utc0: ${p?.sodUtc0 ?? "n/a"}`,
    `sod_utc8: ${p?.sodUtc8 ?? "n/a"}`,
    `ts: ${p?.ts ?? "n/a"}`,
  ].join("\n");
}

function buildErrorText(result = {}, input = {}, mode = "short") {
  const lines = [
    getTitle(mode),
    `inst_id: ${input.instId}`,
    `timeout_ms: ${input.timeoutMs}`,
    `reason: ${result?.meta?.reason || "unknown_error"}`,
    `http_status: ${result?.meta?.status ?? "n/a"}`,
    `api_code: ${result?.meta?.apiCode ?? "n/a"}`,
    `api_msg: ${result?.meta?.apiMsg || "n/a"}`,
  ];

  if (mode === "full") {
    lines.push(`url: ${result?.meta?.url || "n/a"}`);
    lines.push(`raw_preview: ${result?.meta?.rawPreview || "n/a"}`);
    lines.push(`message: ${result?.meta?.message || "n/a"}`);
  }

  return lines.join("\n");
}

export async function handleOkxDebug({
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
      handler: "okxDebug",
      event: "forbidden",
      mode,
    });
    return { handled: true };
  }

  const input = parseOkxArgs(rest);

  try {
    const result = await fetchOkxTicker(input);

    if (!result?.ok) {
      await reply(buildErrorText(result, input, mode), {
        cmd: cmd || defaultCmd,
        handler: "okxDebug",
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
      handler: "okxDebug",
      event: "ticker_ready",
      mode,
      instId: input.instId,
    });

    return { handled: true };
  } catch (error) {
    const text = [
      getTitle(mode),
      `inst_id: ${input.instId}`,
      `timeout_ms: ${input.timeoutMs}`,
      "reason: exception",
      `message: ${error?.message ? String(error.message) : "unknown_error"}`,
    ].join("\n");

    await reply(text, {
      cmd: cmd || defaultCmd,
      handler: "okxDebug",
      event: "exception",
      mode,
    });

    return { handled: true };
  }
}

export default {
  handleOkxDebug,
};