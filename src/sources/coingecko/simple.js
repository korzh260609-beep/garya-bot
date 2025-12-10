// src/sources/coingecko/simple.js
// CoinGecko Simple Price — V1 (адаптирован под data.prices + кэш 15 секунд)

import { fetchFromSourceKey } from "../sources.js";

// ============================================================================
// === AUTO-MAP: популярные тикеры -> CoinGecko IDs ===========================
// ============================================================================

const ID_MAP = {
  btc: "bitcoin",
  xbt: "bitcoin",
  eth: "ethereum",
  sol: "solana",
  bnb: "binancecoin",
  xrp: "ripple",
  ada: "cardano",
  matic: "polygon",
  doge: "dogecoin",
  dot: "polkadot",
  trx: "tron",
  avax: "avalanche-2",
  atom: "cosmos",
  link: "chainlink",
  ltc: "litecoin",
  shib: "shiba-inu",
  sui: "sui",
  apt: "aptos",
};

// нормализация ID
function normalizeId(id) {
  const clean = String(id).trim().toLowerCase();
  return ID_MAP[clean] || clean;
}

// ============================================================================
// === КЭШ ДЛЯ SIMPLE PRICE ====================================================
// ============================================================================

const CACHE_TTL_MS = 15_000; // 15 секунд

let lastData = null;
let lastTs = 0;

async function fetchCoinGeckoCached(opts = {}) {
  const now = Date.now();

  // 1) если кэш свежий — возвращаем его
  if (lastData && now - lastTs < CACHE_TTL_MS) {
    return { ok: true, data: lastData };
  }

  // 2) иначе реальный запрос к Source Layer
  const res = await fetchFromSourceKey("coingecko_simple_price", {
    ...(opts || {}),
  });

  if (res && res.ok) {
    lastData = res.data;
    lastTs = now;
  }

  return res;
}

// ============================================================================
// === Вспомогательная функция: получить контейнер с ценами ====================
// ============================================================================

function extractPricesContainer(data) {
  if (!data || typeof data !== "object") return null;

  // наш формат: { ids: [...], prices: { bitcoin: { usd: ... }, ... }, vs_currency: "usd" }
  if (data.prices && typeof data.prices === "object") {
    return data.prices;
  }

  // fallback — raw.prices
  if (data.raw && typeof data.raw === "object" && data.raw.prices) {
    return data.raw.prices;
  }

  // fallback — вдруг уже плоский объект
  return data;
}

// ============================================================================
// === ОДНА МОНЕТА =============================================================
// ============================================================================

export async function getCoinGeckoSimplePriceById(
  coinId,
  vsCurrency = "usd",
  opts = {}
) {
  if (!coinId) return { ok: false, error: "coinId is required" };

  const cleanId = normalizeId(coinId);
  const cleanVs = String(vsCurrency).trim().toLowerCase();

  const res = await fetchCoinGeckoCached(opts);

  if (!res || !res.ok) {
    return { ok: false, error: res?.error || "CoinGecko source fetch failed" };
  }

  const pricesContainer = extractPricesContainer(res.data);
  if (!pricesContainer) {
    return { ok: false, error: "Invalid CoinGecko data format" };
  }

  const entry = pricesContainer[cleanId];
  if (!entry) {
    return {
      ok: false,
      error: `CoinGecko: id "${cleanId}" not found in response`,
    };
  }

  const price = entry[cleanVs];
  if (typeof price !== "number") {
    return {
      ok: false,
      error: `CoinGecko: price for "${cleanId}" in "${cleanVs}" not found`,
    };
  }

  return { ok: true, id: cleanId, vsCurrency: cleanVs, price, raw: entry };
}

// ============================================================================
// === НЕСКОЛЬКО МОНЕТ ========================================================
// ============================================================================

export async function getCoinGeckoSimplePriceMulti(
  coinIds,
  vsCurrency = "usd",
  opts = {}
) {
  if (!Array.isArray(coinIds) || !coinIds.length) {
    return { ok: false, error: "coinIds must be a non-empty array" };
  }

  const cleanVs = String(vsCurrency).trim().toLowerCase();

  const res = await fetchCoinGeckoCached(opts);

  if (!res || !res.ok) {
    return { ok: false, error: res?.error || "CoinGecko source fetch failed" };
  }

  const pricesContainer = extractPricesContainer(res.data);
  if (!pricesContainer) {
    return { ok: false, error: "Invalid CoinGecko data format" };
  }

  const result = {};
  for (const id of coinIds) {
    const cleanId = normalizeId(id);
    const entry = pricesContainer[cleanId];
    if (!entry) continue;

    const price = entry[cleanVs];
    if (typeof price !== "number") continue;

    result[cleanId] = { id: cleanId, vsCurrency: cleanVs, price, raw: entry };
  }

  if (!Object.keys(result).length) {
    return { ok: false, error: "No matching CoinGecko ids found in response" };
  }

  return { ok: true, vsCurrency: cleanVs, items: result };
}
