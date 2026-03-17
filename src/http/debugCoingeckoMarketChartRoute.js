// src/http/debugCoingeckoMarketChartRoute.js
// ============================================================================
// STAGE 10C.7 — temporary protected debug route for CoinGecko market_chart
// PURPOSE:
// - verify historical-data path through SourceService
// - allow check via browser / Render logs without local terminal
// - keep CoinGecko debug routes in one consistent style
//
// IMPORTANT:
// - temporary developer-only route
// - protected by BOTH:
//   1) DEBUG_SOURCE_TESTS === "true"
//   2) token === DEBUG_SOURCE_TOKEN
// - fail-closed
// - no chat wiring
// - no public access
// - no SourceService modification
// ============================================================================

import express from "express";
import { resolveSourceContext } from "../sources/sourceService.js";

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

export function createDebugCoingeckoMarketChartRoute() {
  const router = express.Router();

  router.get("/debug/source/coingecko-market-chart", async (req, res) => {
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

    const input = {
      sourceKey: "coingecko_market_chart",
      coinId,
      vsCurrency,
      days,
      interval,
    };

    try {
      console.info("DEBUG_COINGECKO_MARKET_CHART_START", {
        coinId,
        vsCurrency,
        days,
        interval: interval || "auto",
      });

      const result = await resolveSourceContext(input);

      const sourceResult = result?.sourceResult || null;
      const parsed = sourceResult?.meta?.parsed || null;
      const prices = parsed?.prices || [];
      const marketCaps = parsed?.marketCaps || [];
      const totalVolumes = parsed?.totalVolumes || [];

      const success = Boolean(
        result &&
          result.ok &&
          sourceResult &&
          sourceResult.ok &&
          sourceResult.sourceKey === "coingecko_market_chart"
      );

      console.info("DEBUG_COINGECKO_MARKET_CHART_END", {
        ok: success,
        sourceKey: sourceResult?.sourceKey || null,
        reason: result?.reason || null,
        sourceReason: sourceResult?.meta?.reason || null,
        pricesCount: Array.isArray(prices) ? prices.length : 0,
        marketCapsCount: Array.isArray(marketCaps) ? marketCaps.length : 0,
        totalVolumesCount: Array.isArray(totalVolumes) ? totalVolumes.length : 0,
        firstPriceTs: Array.isArray(prices) ? prices[0]?.ts ?? null : null,
        lastPriceTs: Array.isArray(prices)
          ? prices[prices.length - 1]?.ts ?? null
          : null,
      });

      return res.status(success ? 200 : 502).json({
        ok: success,
        input: {
          coinId,
          vsCurrency,
          days,
          interval,
        },
        sourceContext: {
          ok: result?.ok === true,
          reason: result?.reason || null,
        },
        sourceResult: {
          ok: sourceResult?.ok === true,
          sourceKey: sourceResult?.sourceKey || null,
          fetchedAt: sourceResult?.fetchedAt || null,
          reason: sourceResult?.meta?.reason || null,
          parsedCounts: {
            prices: Array.isArray(prices) ? prices.length : 0,
            marketCaps: Array.isArray(marketCaps) ? marketCaps.length : 0,
            totalVolumes: Array.isArray(totalVolumes) ? totalVolumes.length : 0,
          },
          parsedRange: {
            firstPriceTs: Array.isArray(prices) ? prices[0]?.ts ?? null : null,
            lastPriceTs: Array.isArray(prices)
              ? prices[prices.length - 1]?.ts ?? null
              : null,
            firstPriceValue: Array.isArray(prices)
              ? prices[0]?.value ?? null
              : null,
            lastPriceValue: Array.isArray(prices)
              ? prices[prices.length - 1]?.value ?? null
              : null,
          },
          meta: sourceResult?.meta || null,
        },
      });
    } catch (error) {
      console.error("DEBUG_COINGECKO_MARKET_CHART_ERROR", {
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
  createDebugCoingeckoMarketChartRoute,
};