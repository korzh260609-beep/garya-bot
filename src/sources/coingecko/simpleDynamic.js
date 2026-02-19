// src/sources/coingecko/simpleDynamic.js
// CoinGecko Simple Price — динамический запрос под любые ids
// FIX: теперь ходим через Sources Layer (fetchFromSourceKey),
// чтобы писались source_runs + error_events + cache/rate-limit.

import { fetchFromSourceKey } from "../sources.js";

// популярные тикеры -> CoinGecko IDs
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

function normalizeId(id) {
  const clean = String(id || "").trim().toLowerCase();
  return ID_MAP[clean] || clean;
}

// -----------------------------
// Compatibility API for /price
// -----------------------------
// handlePrice ожидает функцию getCoinGeckoSimplePriceById(coinId, "usd", { userRole, userPlan })
export async function getCoinGeckoSimplePriceByIdDynamic(
  coinId,
  vsCurrency = "usd",
  options = {}
) {
  if (!coinId) return { ok: false, error: "coinId is required" };

  const cleanId = normalizeId(coinId);
  const cleanVs = String(vsCurrency).trim().toLowerCase();

  const userRole = options?.userRole || null;
  const userPlan = options?.userPlan || null;

  // ВАЖНО: runKey должен различать ids, иначе дедуп по минуте будет “склеивать” разные монеты
  const runKey = `coingecko_simple_price@id:${cleanId}@m${Math.floor(
    Date.now() / 60000
  )}`;

  const res = await fetchFromSourceKey("coingecko_simple_price", {
    userRole,
    userPlan,
    runKey,
    params: {
      ids: [cleanId],
      vs_currency: cleanVs,
    },
  });

  // Пробрасываем httpStatus/error как есть (price.js уже умеет 429)
  if (!res?.ok) {
    return {
      ok: false,
      error: res?.error || "CoinGecko request failed",
      httpStatus: res?.httpStatus ?? null,
      sourceKey: res?.sourceKey || "coingecko_simple_price",
    };
  }

  // sources.js для coingecko возвращает data: { url, ids, vs_currency, prices }
  const data = res?.data || {};
  const prices = data?.prices || res?.raw || {};

  const entry = prices?.[cleanId];
  const price = entry?.[cleanVs];

  if (typeof price !== "number") {
    return {
      ok: false,
      error: `CoinGecko: price for "${cleanId}" in "${cleanVs}" not found`,
      httpStatus: res?.httpStatus ?? null,
      raw: prices,
    };
  }

  return {
    ok: true,
    id: cleanId,
    vsCurrency: cleanVs,
    price,
    httpStatus: res?.httpStatus ?? null,
    fromCache: !!res?.fromCache,
    // url полезен для диагностики
    url: data?.url || null,
    raw: entry,
  };
}

// НЕСКОЛЬКО МОНЕТ (динамический simple/price)
export async function getCoinGeckoSimplePriceMultiDynamic(
  coinIds,
  vsCurrency = "usd",
  options = {}
) {
  if (!Array.isArray(coinIds) || !coinIds.length) {
    return { ok: false, error: "coinIds must be a non-empty array" };
  }

  const cleanVs = String(vsCurrency).trim().toLowerCase();

  const requested = coinIds.map((id) => String(id || "").trim().toLowerCase());
  const canonical = requested.map((id) => normalizeId(id));
  const uniq = [...new Set(canonical)];

  const userRole = options?.userRole || null;
  const userPlan = options?.userPlan || null;

  // Различаем набор ids в runKey, чтобы не склеивалось
  const runKey = `coingecko_simple_price@multi:${uniq.join(
    ","
  )}@m${Math.floor(Date.now() / 60000)}`;

  const res = await fetchFromSourceKey("coingecko_simple_price", {
    userRole,
    userPlan,
    runKey,
    params: {
      ids: uniq,
      vs_currency: cleanVs,
    },
  });

  if (!res?.ok) {
    return {
      ok: false,
      error: res?.error || "CoinGecko request failed",
      httpStatus: res?.httpStatus ?? null,
      sourceKey: res?.sourceKey || "coingecko_simple_price",
    };
  }

  const data = res?.data || {};
  const prices = data?.prices || res?.raw || {};

  const result = {};

  for (let i = 0; i < requested.length; i++) {
    const reqId = requested[i];
    const canId = canonical[i];

    const entry = prices?.[canId];
    if (!entry) continue;

    const price = entry?.[cleanVs];
    if (typeof price !== "number") continue;

    result[reqId] = {
      id: canId,
      vsCurrency: cleanVs,
      price,
      raw: entry,
    };
  }

  if (!Object.keys(result).length) {
    return {
      ok: false,
      error: "No matching CoinGecko ids found in response",
      httpStatus: res?.httpStatus ?? null,
      raw: prices,
    };
  }

  return {
    ok: true,
    vsCurrency: cleanVs,
    items: result,
    httpStatus: res?.httpStatus ?? null,
    fromCache: !!res?.fromCache,
    url: data?.url || null,
    raw: prices,
  };
}
