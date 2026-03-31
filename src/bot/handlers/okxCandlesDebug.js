// src/bot/handlers/okxCandlesDebug.js
// ============================================================================
// STAGE 10D-alt.3 — MONARCH/DEV OKX CANDLES DEBUG HANDLER
// - /okx_candles
// - /okx_candles_full
//
// PURPOSE:
// - expose OKX public candles through SG dev commands
// - no SourceService changes
// - no chat runtime refactor
// - no AI interpretation here
// ============================================================================

import { fetchOkxCandles } from "../../sources/fetchOkxCandles.js";

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

function parseOkxCandlesArgs(rest = "") {
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
  return cmd === "/okx_candles_full" ? "full" : "short";
}

function getTitle(mode = "short") {
  return mode === "full" ? "🧪 OKX CANDLES FULL" : "🧪 OKX CANDLES";
}

function getDefaultCmd(mode = "short") {
  return mode === "full" ? "/okx_candles_full" : "/okx_candles";
}

function buildShortText(result = {}, input = {}) {
  const p = result?.meta?.parsed || {};
  const latest = p?.latest || {};

  return [
    getTitle("short"),
    `inst_id: ${input.instId}`,
    `bar: ${input.bar}`,
    `limit: ${input.limit}`,
    `timeout_ms: ${input.timeoutMs}`,
    "",
    `status: ${result?.ok === true ? "ready" : "not_ready"}`,
    `reason: ${result?.meta?.reason || "n/a"}`,
    `candles_count: ${p?.count ?? "n/a"}`,
    `latest_ts: ${latest?.ts ?? "n/a"}`,
    `latest_open: ${latest?.open ?? "n/a"}`,
    `latest_high: ${latest?.high ?? "n/a"}`,
    `latest_low: ${latest?.low ?? "n/a"}`,
    `latest_close: ${latest?.close ?? "n/a"}`,
    `latest_volume: ${latest?.volume ?? "n/a"}`,
  ].join("\n");
}

function buildFullText(result = {}, input = {}) {
  const p = result?.meta?.parsed || {};
  const latest = p?.latest || {};
  const oldest = p?.oldest || {};
  const candles = Array.isArray(p?.candles) ? p.candles : [];
  const preview = candles.slice(-3);

  const previewLines = preview.map((c, idx) => {
    return [
      `#${idx + 1}`,
      `ts=${c?.ts ?? "n/a"}`,
      `open=${c?.open ?? "n/a"}`,
      `high=${c?.high ?? "n/a"}`,
      `low=${c?.low ?? "n/a"}`,
      `close=${c?.close ?? "n/a"}`,
      `volume=${c?.volume ?? "n/a"}`,
      `confirm=${c?.confirm ?? "n/a"}`,
    ].join(" | ");
  });

  return [
    getTitle("full"),
    `inst_id: ${input.instId}`,
    `bar: ${input.bar}`,
    `limit: ${input.limit}`,
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
    `candles_count: ${p?.count ?? "n/a"}`,
    `oldest_ts: ${oldest?.ts ?? "n/a"}`,
    `latest_ts: ${latest?.ts ?? "n/a"}`,
    `latest_open: ${latest?.open ?? "n/a"}`,
    `latest_high: ${latest?.high ?? "n/a"}`,
    `latest_low: ${latest?.low ?? "n/a"}`,
    `latest_close: ${latest?.close ?? "n/a"}`,
    `latest_volume: ${latest?.volume ?? "n/a"}`,
    "",
    "latest_preview:",
    ...(previewLines.length ? previewLines : ["n/a"]),
  ].join("\n");
}

function buildErrorText(result = {}, input = {}, mode = "short") {
  const lines = [
    getTitle(mode),
    `inst_id: ${input.instId}`,
    `bar: ${input.bar}`,
    `limit: ${input.limit}`,
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

export async function handleOkxCandlesDebug({
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
      handler: "okxCandlesDebug",
      event: "forbidden",
      mode,
    });
    return { handled: true };
  }

  const input = parseOkxCandlesArgs(rest);

  try {
    const result = await fetchOkxCandles(input);

    if (!result?.ok) {
      await reply(buildErrorText(result, input, mode), {
        cmd: cmd || defaultCmd,
        handler: "okxCandlesDebug",
        event: "candles_not_ready",
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
      handler: "okxCandlesDebug",
      event: "candles_ready",
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
      handler: "okxCandlesDebug",
      event: "exception",
      mode,
    });

    return { handled: true };
  }
}

export default {
  handleOkxCandlesDebug,
};