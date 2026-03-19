// src/http/debugCryptoNewsRssRoute.js
// ============================================================================
// STAGE 10C.8 — temporary protected debug route for Crypto News RSS
// PURPOSE:
// - verify news RSS source outside chat runtime
// - allow browser / Render log testing without command wiring
// - keep this step isolated and source-first
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
import { fetchCryptoNewsRss } from "../sources/fetchCryptoNewsRss.js";

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

function normalizePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;

  const out = Math.trunc(n);
  return out > 0 ? out : fallback;
}

function normalizeFeedUrls(value) {
  const raw = normalizeString(value);
  if (!raw) return [];

  return raw
    .split(",")
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function getDefaultFeedUrls() {
  return [
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://cointelegraph.com/rss",
  ];
}

export function createDebugCryptoNewsRssRoute() {
  const router = express.Router();

  router.get("/debug/source/crypto-news-rss", async (req, res) => {
    const debugEnabled = isDebugEnabled();
    const expectedToken = getExpectedToken();
    const providedToken = getProvidedToken(req);

    if (!debugEnabled || !expectedToken || providedToken !== expectedToken) {
      return res.status(403).json({
        ok: false,
        error: "forbidden",
      });
    }

    const feedUrls = normalizeFeedUrls(req.query.feedUrls);
    const timeoutMs = normalizePositiveInt(req.query.timeoutMs, 8000);
    const maxItems = normalizePositiveInt(req.query.maxItems, 10);

    const input = {
      feedUrls: feedUrls.length ? feedUrls : getDefaultFeedUrls(),
      timeoutMs,
      maxItems,
    };

    try {
      console.info("DEBUG_CRYPTO_NEWS_RSS_START", {
        feedsCount: input.feedUrls.length,
        timeoutMs,
        maxItems,
        feedUrls: input.feedUrls,
      });

      const result = await fetchCryptoNewsRss(input);

      console.info("DEBUG_CRYPTO_NEWS_RSS_END", {
        ok: result?.ok === true,
        reason: result?.meta?.reason || null,
        totalFeeds: result?.meta?.totalFeeds ?? null,
        successfulFeeds: result?.meta?.successfulFeeds ?? null,
        failedFeeds: result?.meta?.failedFeeds ?? null,
        totalItemsAfterTrim: result?.meta?.totalItemsAfterTrim ?? null,
      });

      return res.status(result?.ok === true ? 200 : 502).json(result);
    } catch (error) {
      console.error("DEBUG_CRYPTO_NEWS_RSS_ERROR", {
        message: error?.message ? String(error.message) : "unknown_error",
      });

      return res.status(500).json({
        ok: false,
        error: "debug_crypto_news_rss_route_exception",
        message: error?.message ? String(error.message) : "unknown_error",
      });
    }
  });

  return router;
}

export default {
  createDebugCryptoNewsRssRoute,
};