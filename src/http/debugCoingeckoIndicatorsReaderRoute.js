// src/http/debugCoingeckoIndicatorsReaderRoute.js
// ============================================================================
// STAGE 10C.29
// TEMP PROTECTED DEBUG ROUTE FOR SG READER — COINGECKO INDICATORS
//
// PURPOSE:
// - expose normalized SG-friendly reader output over HTTP
// - verify readCoingeckoIndicatorsDebug() without chat wiring
// - keep testing outside Telegram runtime
//
// IMPORTANT:
// - developer-only route
// - protected by BOTH:
//   1) DEBUG_SOURCE_TESTS === "true"
//   2) token === DEBUG_SOURCE_TOKEN
// - fail-closed
// - no chat wiring
// - no SourceService modification
// ============================================================================

import express from "express";
import { readCoingeckoIndicatorsDebug } from "../sources/readCoingeckoIndicatorsDebug.js";

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

  if (!raw) return "30";
  if (raw === "max") return "max";

  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) {
    return String(Math.trunc(n));
  }

  return "30";
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

export function createDebugCoingeckoIndicatorsReaderRoute() {
  const router = express.Router();

  router.get("/debug/source/coingecko-indicators-reader", async (req, res) => {
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
    const timeoutMs = normalizePositiveInt(req.query.timeoutMs, 8000);

    try {
      console.info("DEBUG_COINGECKO_INDICATORS_READER_START", {
        coinId,
        vsCurrency,
        days,
        interval: interval || "auto",
        emaPeriod,
        rsiPeriod,
        timeoutMs,
      });

      const result = await readCoingeckoIndicatorsDebug({
        token: expectedToken,
        coinId,
        vsCurrency,
        days,
        interval,
        emaPeriod,
        rsiPeriod,
        timeoutMs,
      });

      console.info("DEBUG_COINGECKO_INDICATORS_READER_END", {
        ok: result?.ok === true,
        reason: result?.reason || null,
        branch: result?.sgView?.branch || null,
        status: result?.sgView?.status || null,
        readiness: result?.sgView?.readiness || null,
      });

      return res.status(result?.ok === true ? 200 : 502).json(result);
    } catch (error) {
      console.error("DEBUG_COINGECKO_INDICATORS_READER_ERROR", {
        message: error?.message ? String(error.message) : "unknown_error",
      });

      return res.status(500).json({
        ok: false,
        error: "debug_reader_route_exception",
        message: error?.message ? String(error.message) : "unknown_error",
      });
    }
  });

  return router;
}

export default {
  createDebugCoingeckoIndicatorsReaderRoute,
};