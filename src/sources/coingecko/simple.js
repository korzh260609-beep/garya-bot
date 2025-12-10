// src/sources/coingecko/simple.js
// CoinGecko Simple Price — V1 (адаптирован под data.prices)

import { fetchFromSourceKey } from "../sources.js";

function extractPricesContainer(data) {
  if (!data || typeof data !== "object") return null;

  // наш формат: { ids: [...], prices: { bitcoin: { usd: ... }, ... }, vs_currency: "usd" }
  if (data.prices && typeof data.prices === "object") {
    return data.prices;
  }

  // запасной вариант: если вдруг цены лежат в raw.prices
  if (data.raw && typeof data.raw === "object" && data.raw.prices) {
    return data.raw.prices;
  }

  // последний fallback — вдруг уже плоский объект
  return data;
}

export async function getCoinGeckoSimplePriceById(
  coinId,
  vsCurrency = "usd",
  opts = {}
) {
  if (!coinId) return { ok: false, error: "coinId is required" };

  const cleanId = String(coinId).trim().toLowerCase();
  const cleanVs = String(vsCurrency).trim().toLowerCase();

  const res = await fetchFromSourceKey("coingecko_simple_price", {
    ...(opts || {}),
  });

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

export async function getCoinGeckoSimplePriceMulti(
  coinIds,
  vsCurrency = "usd",
  opts = {}
) {
  if (!Array.isArray(coinIds) || !coinIds.length) {
    return { ok: false, error: "coinIds must be a non-empty array" };
  }

  const cleanVs = String(vsCurrency).trim().toLowerCase();

  const res = await fetchFromSourceKey("coingecko_simple_price", {
    ...(opts || {}),
  });

  if (!res || !res.ok) {
    return { ok: false, error: res?.error || "CoinGecko source fetch failed" };
  }

  const pricesContainer = extractPricesContainer(res.data);
  if (!pricesContainer) {
    return { ok: false, error: "Invalid CoinGecko data format" };
  }

  const result = {};
  for (const id of coinIds) {
    const cleanId = String(id).trim().toLowerCase();
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
