// src/sources/fetchOkxTicker.js
// ============================================================================
// STAGE 10D-alt.1 — OKX ticker fetcher (isolated skeleton)
// PURPOSE:
// - first OKX source for Stage 10D alternative path
// - fetch ticker data from OKX public API
// - keep network logic OUT of handlers
// - normalize output into deterministic source structure
//
// IMPORTANT:
// - fetcher-only
// - no SourceService changes
// - no chat wiring
// - no AI interpretation
// - fail-open behavior stays in caller layer
// ============================================================================

import { fetchWithTimeout } from "../core/fetchWithTimeout.js";

export const OKX_TICKER_VERSION = "10D-alt.1-okx-ticker-v1";

const OKX_BASE_URL = "https://www.okx.com/api/v5/market/ticker";

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
  const raw = normalizeString(value).toUpperCase();
  return raw || "BTC-USDT";
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildUrl(instId) {
  const params = new URLSearchParams();
  params.set("instId", instId);
  return `${OKX_BASE_URL}?${params.toString()}`;
}

function parseOkxPayload(payload = {}) {
  const code = normalizeString(payload?.code);
  const data = Array.isArray(payload?.data) ? payload.data : [];
  const row = data[0] || null;

  if (code !== "0" || !row || typeof row !== "object") {
    return {
      ok: false,
      reason: "payload_invalid",
      parsed: null,
      apiCode: code || null,
      apiMsg: normalizeString(payload?.msg) || null,
    };
  }

  const parsed = {
    instType: normalizeString(row?.instType) || null,
    instId: normalizeString(row?.instId) || null,
    last: safeNumber(row?.last),
    lastSz: safeNumber(row?.lastSz),
    askPx: safeNumber(row?.askPx),
    askSz: safeNumber(row?.askSz),
    bidPx: safeNumber(row?.bidPx),
    bidSz: safeNumber(row?.bidSz),
    open24h: safeNumber(row?.open24h),
    high24h: safeNumber(row?.high24h),
    low24h: safeNumber(row?.low24h),
    volCcy24h: safeNumber(row?.volCcy24h),
    vol24h: safeNumber(row?.vol24h),
    sodUtc0: safeNumber(row?.sodUtc0),
    sodUtc8: safeNumber(row?.sodUtc8),
    ts: safeNumber(row?.ts),
  };

  return {
    ok: typeof parsed.last === "number",
    reason: typeof parsed.last === "number" ? "ticker_ready" : "ticker_partial",
    parsed,
    apiCode: code,
    apiMsg: normalizeString(payload?.msg) || null,
  };
}

function buildContentText(parsed = null) {
  if (!parsed || typeof parsed !== "object") return "";

  return [
    `inst_id: ${parsed.instId || "n/a"}`,
    `last: ${parsed.last ?? "n/a"}`,
    `bid: ${parsed.bidPx ?? "n/a"}`,
    `ask: ${parsed.askPx ?? "n/a"}`,
    `open_24h: ${parsed.open24h ?? "n/a"}`,
    `high_24h: ${parsed.high24h ?? "n/a"}`,
    `low_24h: ${parsed.low24h ?? "n/a"}`,
    `vol_24h: ${parsed.vol24h ?? "n/a"}`,
    `vol_ccy_24h: ${parsed.volCcy24h ?? "n/a"}`,
  ].join("\n");
}

export async function fetchOkxTicker(input = {}) {
  const instId = normalizeInstId(input?.instId);
  const timeoutMs = normalizePositiveInt(input?.timeoutMs, 8000);
  const url = buildUrl(instId);
  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      },
      timeoutMs
    );

    const fetchedAt = new Date().toISOString();
    const durationMs = Date.now() - startedAt;
    const rawText = await response.text();

    let payload = null;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch (_) {
      payload = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        sourceKey: "okx_ticker",
        content: "",
        fetchedAt,
        meta: {
          version: OKX_TICKER_VERSION,
          reason: "http_error",
          status: response.status,
          statusText: response.statusText || "",
          instId,
          timeoutMs,
          url,
          durationMs,
          rawPreview: typeof rawText === "string" ? rawText.slice(0, 500) : "",
        },
      };
    }

    const parsedResult = parseOkxPayload(payload);
    const content = buildContentText(parsedResult.parsed);

    return {
      ok: parsedResult.ok,
      sourceKey: "okx_ticker",
      content,
      fetchedAt,
      meta: {
        version: OKX_TICKER_VERSION,
        reason: parsedResult.reason,
        status: response.status,
        instId,
        timeoutMs,
        url,
        durationMs,
        apiCode: parsedResult.apiCode,
        apiMsg: parsedResult.apiMsg,
        parsed: parsedResult.parsed,
      },
    };
  } catch (error) {
    return {
      ok: false,
      sourceKey: "okx_ticker",
      content: "",
      fetchedAt: new Date().toISOString(),
      meta: {
        version: OKX_TICKER_VERSION,
        reason: "network_error",
        message: error?.message ? String(error.message) : "unknown_error",
        instId,
        timeoutMs,
        url,
      },
    };
  }
}

export default {
  fetchOkxTicker,
};