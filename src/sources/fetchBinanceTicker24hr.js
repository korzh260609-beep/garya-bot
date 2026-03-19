// src/sources/fetchBinanceTicker24hr.js
// ============================================================================
// STAGE 10D.1 — Binance ticker 24hr fetcher (isolated skeleton)
// PURPOSE:
// - first Binance source for Stage 10D
// - fetch 24hr ticker stats from Binance public API
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

export const BINANCE_TICKER_24HR_VERSION = "10D.1-binance-ticker24hr-v1";

const BINANCE_BASE_URL = "https://api.binance.com/api/v3/ticker/24hr";

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

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildUrl(symbol) {
  const params = new URLSearchParams();
  params.set("symbol", symbol);
  return `${BINANCE_BASE_URL}?${params.toString()}`;
}

function parseTickerPayload(payload = {}) {
  const symbol = normalizeString(payload?.symbol).toUpperCase();

  if (!symbol) {
    return {
      ok: false,
      reason: "payload_invalid",
      parsed: null,
    };
  }

  const parsed = {
    symbol,
    priceChange: safeNumber(payload?.priceChange),
    priceChangePercent: safeNumber(payload?.priceChangePercent),
    weightedAvgPrice: safeNumber(payload?.weightedAvgPrice),
    lastPrice: safeNumber(payload?.lastPrice),
    lastQty: safeNumber(payload?.lastQty),
    openPrice: safeNumber(payload?.openPrice),
    highPrice: safeNumber(payload?.highPrice),
    lowPrice: safeNumber(payload?.lowPrice),
    volume: safeNumber(payload?.volume),
    quoteVolume: safeNumber(payload?.quoteVolume),
    openTime: safeNumber(payload?.openTime),
    closeTime: safeNumber(payload?.closeTime),
    firstId: safeNumber(payload?.firstId),
    lastId: safeNumber(payload?.lastId),
    count: safeNumber(payload?.count),
  };

  return {
    ok: typeof parsed.lastPrice === "number",
    reason: typeof parsed.lastPrice === "number" ? "ticker_ready" : "ticker_partial",
    parsed,
  };
}

function buildContentText(parsed = null) {
  if (!parsed || typeof parsed !== "object") return "";

  return [
    `symbol: ${parsed.symbol || "n/a"}`,
    `last_price: ${parsed.lastPrice ?? "n/a"}`,
    `price_change: ${parsed.priceChange ?? "n/a"}`,
    `price_change_percent: ${parsed.priceChangePercent ?? "n/a"}`,
    `high_price: ${parsed.highPrice ?? "n/a"}`,
    `low_price: ${parsed.lowPrice ?? "n/a"}`,
    `volume: ${parsed.volume ?? "n/a"}`,
    `quote_volume: ${parsed.quoteVolume ?? "n/a"}`,
  ].join("\n");
}

export async function fetchBinanceTicker24hr(input = {}) {
  const symbol = normalizeSymbol(input?.symbol);
  const timeoutMs = normalizePositiveInt(input?.timeoutMs, 8000);
  const url = buildUrl(symbol);
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
        sourceKey: "binance_ticker_24hr",
        content: "",
        fetchedAt,
        meta: {
          version: BINANCE_TICKER_24HR_VERSION,
          reason: "http_error",
          status: response.status,
          statusText: response.statusText || "",
          symbol,
          timeoutMs,
          url,
          durationMs,
          rawPreview: typeof rawText === "string" ? rawText.slice(0, 500) : "",
        },
      };
    }

    const parsedResult = parseTickerPayload(payload);
    const content = buildContentText(parsedResult.parsed);

    return {
      ok: parsedResult.ok,
      sourceKey: "binance_ticker_24hr",
      content,
      fetchedAt,
      meta: {
        version: BINANCE_TICKER_24HR_VERSION,
        reason: parsedResult.reason,
        status: response.status,
        symbol,
        timeoutMs,
        url,
        durationMs,
        parsed: parsedResult.parsed,
      },
    };
  } catch (error) {
    return {
      ok: false,
      sourceKey: "binance_ticker_24hr",
      content: "",
      fetchedAt: new Date().toISOString(),
      meta: {
        version: BINANCE_TICKER_24HR_VERSION,
        reason: "network_error",
        message: error?.message ? String(error.message) : "unknown_error",
        symbol,
        timeoutMs,
        url,
      },
    };
  }
}

export default {
  fetchBinanceTicker24hr,
};