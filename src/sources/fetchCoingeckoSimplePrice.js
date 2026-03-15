// src/sources/fetchCoingeckoSimplePrice.js
// ============================================================================
// STAGE 10.6 — CoinGecko Simple Price fetcher (isolated skeleton)
// PURPOSE:
// - first real source fetch implementation in isolated module
// - keep network logic OUT of chat handler
// - keep parser minimal and deterministic
//
// IMPORTANT:
// - this module is fetcher-only
// - no chat wiring yet
// - no automatic activation yet
// - fail-open behavior must stay in caller layer
// - CoinGecko free tier may return 429 / temporary failures
// ============================================================================

import fetch from "node-fetch";

export const COINGECKO_SIMPLE_PRICE_VERSION = "10.6-skeleton-v1";

const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3/simple/price";

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIds(value) {
  return normalizeArray(value)
    .map((item) => normalizeString(item).toLowerCase())
    .filter(Boolean);
}

function normalizeVsCurrencies(value) {
  return normalizeArray(value)
    .map((item) => normalizeString(item).toLowerCase())
    .filter(Boolean);
}

function buildQuery(ids, vsCurrencies) {
  const params = new URLSearchParams();

  params.set("ids", ids.join(","));
  params.set("vs_currencies", vsCurrencies.join(","));
  params.set("include_market_cap", "true");
  params.set("include_24hr_vol", "true");
  params.set("include_24hr_change", "true");
  params.set("include_last_updated_at", "true");

  return params.toString();
}

function buildUrl(ids, vsCurrencies) {
  return `${COINGECKO_BASE_URL}?${buildQuery(ids, vsCurrencies)}`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseCoinGeckoPayload(payload, ids, vsCurrencies) {
  if (!isPlainObject(payload)) {
    return {
      ok: false,
      parsed: {},
      reason: "payload_not_object",
    };
  }

  const parsed = {};

  for (const id of ids) {
    const coinBlock = isPlainObject(payload[id]) ? payload[id] : null;
    if (!coinBlock) continue;

    const coinOut = {};

    for (const vs of vsCurrencies) {
      coinOut[vs] = {
        price: safeNumber(coinBlock[vs]),
        marketCap: safeNumber(coinBlock[`${vs}_market_cap`]),
        volume24h: safeNumber(coinBlock[`${vs}_24h_vol`]),
        change24h: safeNumber(coinBlock[`${vs}_24h_change`]),
      };
    }

    coinOut.lastUpdatedAt = safeNumber(coinBlock.last_updated_at);
    parsed[id] = coinOut;
  }

  return {
    ok: Object.keys(parsed).length > 0,
    parsed,
    reason: Object.keys(parsed).length > 0 ? "parsed_ok" : "parsed_empty",
  };
}

function buildContentText(parsed) {
  const ids = Object.keys(parsed || {});
  if (!ids.length) return "";

  const lines = [];

  for (const id of ids) {
    const coinBlock = parsed[id];
    const subKeys = Object.keys(coinBlock || {}).filter((k) => k !== "lastUpdatedAt");

    lines.push(`coin: ${id}`);

    for (const vs of subKeys) {
      const row = coinBlock[vs] || {};
      lines.push(
        `  ${vs}: price=${row.price ?? "n/a"}, market_cap=${row.marketCap ?? "n/a"}, volume_24h=${row.volume24h ?? "n/a"}, change_24h=${row.change24h ?? "n/a"}`
      );
    }

    lines.push(`  last_updated_at=${coinBlock.lastUpdatedAt ?? "n/a"}`);
  }

  return lines.join("\n");
}

export async function fetchCoinGeckoSimplePrice(input = {}) {
  const ids = normalizeIds(input?.ids || []);
  const vsCurrencies = normalizeVsCurrencies(input?.vsCurrencies || ["usd"]);

  if (!ids.length) {
    return {
      ok: false,
      sourceKey: "coingecko_simple_price",
      content: "",
      fetchedAt: new Date().toISOString(),
      meta: {
        version: COINGECKO_SIMPLE_PRICE_VERSION,
        reason: "missing_ids",
      },
    };
  }

  if (!vsCurrencies.length) {
    return {
      ok: false,
      sourceKey: "coingecko_simple_price",
      content: "",
      fetchedAt: new Date().toISOString(),
      meta: {
        version: COINGECKO_SIMPLE_PRICE_VERSION,
        reason: "missing_vs_currencies",
      },
    };
  }

  const url = buildUrl(ids, vsCurrencies);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    });

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
        sourceKey: "coingecko_simple_price",
        content: "",
        fetchedAt,
        meta: {
          version: COINGECKO_SIMPLE_PRICE_VERSION,
          reason: "http_error",
          status: response.status,
          statusText: response.statusText || "",
          url,
          durationMs,
          ids,
          vsCurrencies,
          rawPreview: typeof rawText === "string" ? rawText.slice(0, 500) : "",
        },
      };
    }

    const parsedResult = parseCoinGeckoPayload(payload, ids, vsCurrencies);
    const content = buildContentText(parsedResult.parsed);

    return {
      ok: parsedResult.ok,
      sourceKey: "coingecko_simple_price",
      content,
      fetchedAt,
      meta: {
        version: COINGECKO_SIMPLE_PRICE_VERSION,
        reason: parsedResult.reason,
        status: response.status,
        url,
        durationMs,
        ids,
        vsCurrencies,
        parsed: parsedResult.parsed,
      },
    };
  } catch (error) {
    return {
      ok: false,
      sourceKey: "coingecko_simple_price",
      content: "",
      fetchedAt: new Date().toISOString(),
      meta: {
        version: COINGECKO_SIMPLE_PRICE_VERSION,
        reason: "network_error",
        message: error?.message ? String(error.message) : "unknown_error",
        ids,
        vsCurrencies,
        url,
      },
    };
  }
}

export default {
  fetchCoinGeckoSimplePrice,
};