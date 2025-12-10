// src/sources/coingecko/simpleDynamic.js
// CoinGecko Simple Price — динамический запрос под любые ids

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

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

async function httpGetJson(url) {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
  });

  if (!res.ok) {
    return {
      ok: false,
      httpStatus: res.status,
      error: `HTTP ${res.status}`,
    };
  }

  const json = await res.json();
  return { ok: true, httpStatus: res.status, data: json };
}

// ОДНА МОНЕТА (динамический simple/price)
export async function getCoinGeckoSimplePriceByIdDynamic(
  coinId,
  vsCurrency = "usd"
) {
  if (!coinId) return { ok: false, error: "coinId is required" };

  const cleanId = normalizeId(coinId);
  const cleanVs = String(vsCurrency).trim().toLowerCase();

  const idsParam = encodeURIComponent(cleanId);
  const vsParam = encodeURIComponent(cleanVs);

  const url = `${COINGECKO_BASE}/simple/price?ids=${idsParam}&vs_currencies=${vsParam}`;

  const res = await httpGetJson(url);
  if (!res.ok) {
    return {
      ok: false,
      error: res.error || "CoinGecko request failed",
      httpStatus: res.httpStatus,
      url,
    };
  }

  const entry = res.data[cleanId];
  if (!entry || typeof entry[cleanVs] !== "number") {
    return {
      ok: false,
      error: `CoinGecko: price for "${cleanId}" in "${cleanVs}" not found`,
      url,
      raw: res.data,
    };
  }

  return {
    ok: true,
    id: cleanId,
    vsCurrency: cleanVs,
    price: entry[cleanVs],
    url,
    raw: entry,
  };
}

// НЕСКОЛЬКО МОНЕТ (динамический simple/price)
export async function getCoinGeckoSimplePriceMultiDynamic(
  coinIds,
  vsCurrency = "usd"
) {
  if (!Array.isArray(coinIds) || !coinIds.length) {
    return { ok: false, error: "coinIds must be a non-empty array" };
  }

  const cleanVs = String(vsCurrency).trim().toLowerCase();

  const requested = coinIds.map((id) => String(id || "").trim().toLowerCase());
  const canonical = requested.map((id) => normalizeId(id));

  const idsParam = encodeURIComponent([...new Set(canonical)].join(","));
  const vsParam = encodeURIComponent(cleanVs);

  const url = `${COINGECKO_BASE}/simple/price?ids=${idsParam}&vs_currencies=${vsParam}`;

  const res = await httpGetJson(url);
  if (!res.ok) {
    return {
      ok: false,
      error: res.error || "CoinGecko request failed",
      httpStatus: res.httpStatus,
      url,
    };
  }

  const data = res.data || {};
  const result = {};

  for (let i = 0; i < requested.length; i++) {
    const reqId = requested[i];
    const canId = canonical[i];

    const entry = data[canId];
    if (!entry) continue;

    const price = entry[cleanVs];
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
      url,
      raw: data,
    };
  }

  return {
    ok: true,
    vsCurrency: cleanVs,
    items: result,
    url,
    raw: data,
  };
}

