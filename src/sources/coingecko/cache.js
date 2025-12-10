// src/sources/coingecko/cache.js

// Кэш для ответов CoinGecko Simple Price
// Хранит последние данные и время запроса

let cacheData = null;
let cacheTimestamp = 0;

export function getCachedCoinGecko() {
  return cacheData;
}

export function setCachedCoinGecko(data) {
  cacheData = data;
  cacheTimestamp = Date.now();
}

export function isCoinGeckoCacheFresh(ttlMs = 15000) {
  if (!cacheTimestamp) return false;
  return Date.now() - cacheTimestamp < ttlMs;
}

