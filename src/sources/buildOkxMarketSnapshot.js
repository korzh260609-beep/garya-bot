// src/sources/buildOkxMarketSnapshot.js
// ============================================================================
// STAGE 10D-alt.4 — OKX market snapshot layer
// PURPOSE:
// - combine OKX ticker + candles into one normalized snapshot
// - keep assembly deterministic
// - no AI interpretation
// - no chat wiring
// - fail-open
// ============================================================================

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeString(value) {
  return value == null ? "" : String(value);
}

function formatIso(ts) {
  const n = safeNumber(ts);
  if (typeof n !== "number") return null;

  try {
    return new Date(n).toISOString();
  } catch (_) {
    return null;
  }
}

function buildCandleSummary(candles = []) {
  if (!Array.isArray(candles) || !candles.length) {
    return {
      count: 0,
      latest: null,
      oldest: null,
      highMax: null,
      lowMin: null,
      closeChangePct: null,
    };
  }

  const latest = candles[candles.length - 1] || null;
  const oldest = candles[0] || null;

  let highMax = null;
  let lowMin = null;

  for (const c of candles) {
    const high = safeNumber(c?.high);
    const low = safeNumber(c?.low);

    if (typeof high === "number") {
      highMax = highMax == null ? high : Math.max(highMax, high);
    }

    if (typeof low === "number") {
      lowMin = lowMin == null ? low : Math.min(lowMin, low);
    }
  }

  const oldestClose = safeNumber(oldest?.close);
  const latestClose = safeNumber(latest?.close);

  let closeChangePct = null;
  if (
    typeof oldestClose === "number" &&
    typeof latestClose === "number" &&
    oldestClose !== 0
  ) {
    closeChangePct = ((latestClose - oldestClose) / oldestClose) * 100;
  }

  return {
    count: candles.length,
    latest,
    oldest,
    highMax,
    lowMin,
    closeChangePct,
  };
}

export function buildOkxMarketSnapshot({
  instId,
  bar,
  tickerResult,
  candlesResult,
}) {
  const tickerOk = tickerResult?.ok === true;
  const candlesOk = candlesResult?.ok === true;

  const ticker = tickerResult?.meta?.parsed || null;
  const candlesParsed = candlesResult?.meta?.parsed || null;
  const candles = Array.isArray(candlesParsed?.candles)
    ? candlesParsed.candles
    : [];

  const candleSummary = buildCandleSummary(candles);

  const snapshot = {
    instId: safeString(instId || ticker?.instId || ""),
    bar: safeString(bar || candlesResult?.meta?.bar || ""),
    ticker: {
      ok: tickerOk,
      last: safeNumber(ticker?.last),
      bidPx: safeNumber(ticker?.bidPx),
      askPx: safeNumber(ticker?.askPx),
      open24h: safeNumber(ticker?.open24h),
      high24h: safeNumber(ticker?.high24h),
      low24h: safeNumber(ticker?.low24h),
      vol24h: safeNumber(ticker?.vol24h),
      volCcy24h: safeNumber(ticker?.volCcy24h),
      ts: safeNumber(ticker?.ts),
      tsIso: formatIso(ticker?.ts),
    },
    candles: {
      ok: candlesOk,
      count: candleSummary.count,
      latestTs: safeNumber(candleSummary.latest?.ts),
      latestTsIso: formatIso(candleSummary.latest?.ts),
      latestOpen: safeNumber(candleSummary.latest?.open),
      latestHigh: safeNumber(candleSummary.latest?.high),
      latestLow: safeNumber(candleSummary.latest?.low),
      latestClose: safeNumber(candleSummary.latest?.close),
      latestVolume: safeNumber(candleSummary.latest?.volume),
      oldestTs: safeNumber(candleSummary.oldest?.ts),
      oldestTsIso: formatIso(candleSummary.oldest?.ts),
      rangeHigh: candleSummary.highMax,
      rangeLow: candleSummary.lowMin,
      closeChangePct: candleSummary.closeChangePct,
    },
  };

  const ok = tickerOk && candlesOk;

  return {
    ok,
    reason: ok ? "snapshot_ready" : "snapshot_partial",
    snapshot,
    parts: {
      tickerOk,
      candlesOk,
      tickerReason: tickerResult?.meta?.reason || null,
      candlesReason: candlesResult?.meta?.reason || null,
    },
  };
}

export default {
  buildOkxMarketSnapshot,
};