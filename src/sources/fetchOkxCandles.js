// src/sources/fetchOkxCandles.js
// ============================================================================
// STAGE 10D-alt.3 — OKX candles fetcher (isolated skeleton)
// PURPOSE:
// - first OKX public candles source for Stage 10D-alt
// - fetch candles from OKX public API
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

export const OKX_CANDLES_VERSION = "10D-alt.3-okx-candles-v1";

const OKX_CANDLES_URL = "https://www.okx.com/api/v5/market/candles";

const ALLOWED_BARS = new Set([
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1H",
  "2H",
  "4H",
  "6H",
  "12H",
  "1D",
  "1W",
]);

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
  const raw = normalizeString(value);
  if (!raw) return "1H";
  return ALLOWED_BARS.has(raw) ? raw : "1H";
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildUrl({ instId, bar, limit }) {
  const params = new URLSearchParams();
  params.set("instId", instId);
  params.set("bar", bar);
  params.set("limit", String(limit));
  return `${OKX_CANDLES_URL}?${params.toString()}`;
}

function parseOneCandle(row) {
  if (!Array.isArray(row) || row.length < 9) {
    return null;
  }

  const ts = safeNumber(row[0]);
  const open = safeNumber(row[1]);
  const high = safeNumber(row[2]);
  const low = safeNumber(row[3]);
  const close = safeNumber(row[4]);
  const volume = safeNumber(row[5]);
  const volumeCcy = safeNumber(row[6]);
  const volumeCcyQuote = safeNumber(row[7]);
  const confirm = normalizeString(row[8]);

  if (
    typeof ts !== "number" ||
    typeof open !== "number" ||
    typeof high !== "number" ||
    typeof low !== "number" ||
    typeof close !== "number"
  ) {
    return null;
  }

  return {
    ts,
    open,
    high,
    low,
    close,
    volume,
    volumeCcy,
    volumeCcyQuote,
    confirm: confirm || null,
  };
}

function parseOkxCandlesPayload(payload = {}) {
  const code = normalizeString(payload?.code);
  const data = Array.isArray(payload?.data) ? payload.data : [];

  if (code !== "0") {
    return {
      ok: false,
      reason: "payload_invalid",
      parsed: null,
      apiCode: code || null,
      apiMsg: normalizeString(payload?.msg) || null,
    };
  }

  const candlesDesc = data.map(parseOneCandle).filter(Boolean);

  if (!candlesDesc.length) {
    return {
      ok: false,
      reason: "candles_empty",
      parsed: {
        candles: [],
        latest: null,
        oldest: null,
        count: 0,
      },
      apiCode: code,
      apiMsg: normalizeString(payload?.msg) || null,
    };
  }

  const candlesAsc = [...candlesDesc].sort((a, b) => a.ts - b.ts);

  return {
    ok: true,
    reason: "candles_ready",
    parsed: {
      candles: candlesAsc,
      latest: candlesAsc[candlesAsc.length - 1] || null,
      oldest: candlesAsc[0] || null,
      count: candlesAsc.length,
    },
    apiCode: code,
    apiMsg: normalizeString(payload?.msg) || null,
  };
}

function buildContentText(parsed = null, input = {}) {
  if (!parsed || !Array.isArray(parsed.candles) || !parsed.candles.length) {
    return "";
  }

  const latest = parsed.latest || {};
  const oldest = parsed.oldest || {};

  return [
    `inst_id: ${input.instId || "n/a"}`,
    `bar: ${input.bar || "n/a"}`,
    `limit: ${input.limit || "n/a"}`,
    `candles_count: ${parsed.count ?? 0}`,
    `latest_ts: ${latest.ts ?? "n/a"}`,
    `latest_open: ${latest.open ?? "n/a"}`,
    `latest_high: ${latest.high ?? "n/a"}`,
    `latest_low: ${latest.low ?? "n/a"}`,
    `latest_close: ${latest.close ?? "n/a"}`,
    `latest_volume: ${latest.volume ?? "n/a"}`,
    `oldest_ts: ${oldest.ts ?? "n/a"}`,
  ].join("\n");
}

export async function fetchOkxCandles(input = {}) {
  const instId = normalizeInstId(input?.instId);
  const bar = normalizeBar(input?.bar);
  const limit = normalizePositiveInt(input?.limit, 100, 1, 300);
  const timeoutMs = normalizePositiveInt(input?.timeoutMs, 8000, 1000, 60000);

  const url = buildUrl({ instId, bar, limit });
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
        sourceKey: "okx_candles",
        content: "",
        fetchedAt,
        meta: {
          version: OKX_CANDLES_VERSION,
          reason: "http_error",
          status: response.status,
          statusText: response.statusText || "",
          instId,
          bar,
          limit,
          timeoutMs,
          url,
          durationMs,
          rawPreview: typeof rawText === "string" ? rawText.slice(0, 500) : "",
        },
      };
    }

    const parsedResult = parseOkxCandlesPayload(payload);
    const content = buildContentText(parsedResult.parsed, {
      instId,
      bar,
      limit,
    });

    return {
      ok: parsedResult.ok,
      sourceKey: "okx_candles",
      content,
      fetchedAt,
      meta: {
        version: OKX_CANDLES_VERSION,
        reason: parsedResult.reason,
        status: response.status,
        instId,
        bar,
        limit,
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
      sourceKey: "okx_candles",
      content: "",
      fetchedAt: new Date().toISOString(),
      meta: {
        version: OKX_CANDLES_VERSION,
        reason: "network_error",
        message: error?.message ? String(error.message) : "unknown_error",
        instId,
        bar,
        limit,
        timeoutMs,
        url,
      },
    };
  }
}

export default {
  fetchOkxCandles,
};