// src/sources/coingecko/simple.js
// CoinGecko Simple Price — V1

import { fetchFromSourceKey } from "../sources.js";

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

  const data = res.data;
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Invalid CoinGecko data format" };
  }

  const entry = data[cleanId];
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

  const data = res.data;
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Invalid CoinGecko data format" };
  }

  const result = {};
  for (const id of coinIds) {
    const cleanId = String(id).trim().toLowerCase();
    const entry = data[cleanId];
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

