// src/http/debugCoingeckoIndicatorsRoute.js
// ============================================================================
// STAGE 10C.7 — temporary protected debug route for CoinGecko indicators
// PURPOSE:
// - verify indicators logic on top of market_chart historical data
// - keep verification outside chat runtime
// - allow browser / Render log testing without command wiring
//
// IMPORTANT:
// - developer-only route
// - protected by BOTH:
//   1) DEBUG_SOURCE_TESTS === "true"
//   2) token === DEBUG_SOURCE_TOKEN
// - fail-closed
// - no chat wiring
// - no SourceService modification
// - EMA / EMA Cross / RSI / MACD are implemented
// - summary layer is now exposed for verification
// ============================================================================

import express from "express";
import { fetchCoinGeckoMarketChart } from "../sources/fetchCoingeckoMarketChart.js";
import {
  buildIndicatorBundle,
  buildCoingeckoIndicatorsDebugText,
} from "../sources/coingeckoIndicators.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isDebugEnabled() {
  return (
    String(process.env.DEBUG_SOURCE_TESTS || "").trim().toLowerCase() === "true"
  );
}

function getExpectedToken() {
  return normalizeString(process.env.DEBUG_SOURCE_TOKEN || "");
}

function getProvidedToken(req) {
  const headerToken = normalizeString(req.headers["x-debug-token"]);
  const queryToken = normalizeString(req.query.token);
  return headerToken || queryToken;
}

function normalizeCoinId(value) {
  return normalizeString(value).toLowerCase() || "bitcoin";
}

function normalizeVsCurrency(value) {
  return normalizeString(value).toLowerCase() || "usd";
}

function normalizeDays(value) {
  const raw = normalizeString(value).toLowerCase();

  if (!raw) return "7";
  if (raw === "max") return "max";

  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) {
    return String(Math.trunc(n));
  }

  return "7";
}

function normalizeInterval(value) {
  const raw = normalizeString(value).toLowerCase();

  if (!raw) return "";
  if (raw === "daily") return "daily";
  if (raw === "hourly") return "hourly";

  return "";
}

function normalizePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;

  const out = Math.trunc(n);
  return out > 0 ? out : fallback;
}

export function createDebugCoingeckoIndicatorsRoute() {
  const router = express.Router();

  router.get("/debug/source/coingecko-indicators", async (req, res) => {
    const debugEnabled = isDebugEnabled();
    const expectedToken = getExpectedToken();
    const providedToken = getProvidedToken(req);

    if (!debugEnabled || !expectedToken || providedToken !== expectedToken) {
      return res.status(403).json({
        ok: false,
        error: "forbidden",
      });
    }

    const coinId = normalizeCoinId(req.query.coinId);
    const vsCurrency = normalizeVsCurrency(req.query.vsCurrency);
    const days = normalizeDays(req.query.days);
    const interval = normalizeInterval(req.query.interval);
    const emaPeriod = normalizePositiveInt(req.query.emaPeriod, 20);
    const rsiPeriod = normalizePositiveInt(req.query.rsiPeriod, 14);

    const fetchInput = {
      coinId,
      vsCurrency,
      days,
      interval,
    };

    try {
      console.info("DEBUG_COINGECKO_INDICATORS_START", {
        coinId,
        vsCurrency,
        days,
        interval: interval || "auto",
        emaPeriod,
        rsiPeriod,
      });

      const marketChartResult = await fetchCoinGeckoMarketChart(fetchInput);

      const prices = marketChartResult?.meta?.parsed?.prices || [];
      const indicators = buildIndicatorBundle({
        prices,
        emaPeriod,
        rsiPeriod,
      });

      const debugText = buildCoingeckoIndicatorsDebugText({
        prices,
        emaPeriod,
        rsiPeriod,
      });

      const success = Boolean(
        marketChartResult?.ok === true &&
          Array.isArray(prices) &&
          indicators?.ok === true
      );

      console.info("DEBUG_COINGECKO_INDICATORS_END", {
        ok: success,
        marketChartOk: marketChartResult?.ok === true,
        pricesCount: Array.isArray(prices) ? prices.length : 0,
        indicatorReason: indicators?.reason || null,
        emaReason: indicators?.indicators?.ema20?.reason || null,
        emaLatest: indicators?.indicators?.ema20?.output?.latest?.value ?? null,
        marketBias:
          indicators?.summary?.marketBias?.signal ?? null,
        momentumBias:
          indicators?.summary?.momentumBias?.signal ?? null,
      });

      return res.status(success ? 200 : 502).json({
        ok: success,
        input: {
          coinId,
          vsCurrency,
          days,
          interval,
          emaPeriod,
          rsiPeriod,
        },
        marketChart: {
          ok: marketChartResult?.ok === true,
          reason: marketChartResult?.meta?.reason || null,
          sourceKey: marketChartResult?.sourceKey || null,
          fetchedAt: marketChartResult?.fetchedAt || null,
          pricesCount: Array.isArray(prices) ? prices.length : 0,
        },
        indicators,
        debugText,
      });
    } catch (error) {
      console.error("DEBUG_COINGECKO_INDICATORS_ERROR", {
        message: error?.message ? String(error.message) : "unknown_error",
      });

      return res.status(500).json({
        ok: false,
        error: "debug_route_exception",
        message: error?.message ? String(error.message) : "unknown_error",
      });
    }
  });

  return router;
}

export default {
  createDebugCoingeckoIndicatorsRoute,
};