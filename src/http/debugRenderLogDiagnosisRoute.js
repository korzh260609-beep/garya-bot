// src/http/debugRenderLogDiagnosisRoute.js
// ============================================================================
// STAGE SKELETON — temporary protected debug route for Render log diagnosis
// PURPOSE:
// - verify RenderLogDiagnosisService outside chat runtime
// - allow safe testing with pasted log snapshots
// - keep diagnosis flow behind debug flag + token
//
// IMPORTANT:
// - developer-only route
// - protected by BOTH:
//   1) DEBUG_SOURCE_TESTS === "true"
//   2) token === DEBUG_SOURCE_TOKEN
// - fail-closed
// - no chat wiring
// - no automatic Render access
// - accepts raw log text via POST body or query
// ============================================================================

import express from "express";
import RenderLogDiagnosisService from "../logging/RenderLogDiagnosisService.js";

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

function normalizeLogText(req) {
  const bodyLog =
    typeof req.body?.logText === "string" ? req.body.logText : "";
  const queryLog =
    typeof req.query?.logText === "string" ? req.query.logText : "";

  const raw = bodyLog || queryLog;
  return typeof raw === "string" ? raw.trim() : "";
}

function normalizeSource(req) {
  const bodySource =
    typeof req.body?.source === "string" ? req.body.source : "";
  const querySource =
    typeof req.query?.source === "string" ? req.query.source : "";

  return normalizeString(bodySource || querySource || "debug_route");
}

function normalizeBoolean(value, fallback = false) {
  const raw = normalizeString(value).toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(raw);
}

function buildDebugResponse(diagnosis, includeFull = false) {
  if (!includeFull) {
    return {
      ok: true,
      shortText: diagnosis.shortText,
      diagnosisVersion: diagnosis.diagnosisVersion,
      createdAt: diagnosis.createdAt,
      source: diagnosis.source,
      fingerprint: {
        kind: diagnosis?.fingerprint?.kind || "unknown",
        severity: diagnosis?.fingerprint?.severity || "unknown",
        confidence: diagnosis?.fingerprint?.confidence || "very_low",
        errorHeadline: diagnosis?.fingerprint?.errorHeadline || "unknown",
      },
      correlation: {
        confidence: diagnosis?.correlation?.confidence || "very_low",
        topCandidate: diagnosis?.correlation?.topCandidate || null,
        lineWindow: diagnosis?.correlation?.lineWindow || null,
      },
    };
  }

  return {
    ok: true,
    ...diagnosis,
  };
}

export function createDebugRenderLogDiagnosisRoute() {
  const router = express.Router();

  router.post("/debug/source/render-log-diagnosis", async (req, res) => {
    const debugEnabled = isDebugEnabled();
    const expectedToken = getExpectedToken();
    const providedToken = getProvidedToken(req);

    if (!debugEnabled || !expectedToken || providedToken !== expectedToken) {
      return res.status(403).json({
        ok: false,
        error: "forbidden",
      });
    }

    const logText = normalizeLogText(req);
    const source = normalizeSource(req);
    const includeFull = normalizeBoolean(req.query.full || req.body?.full, false);

    if (!logText) {
      return res.status(400).json({
        ok: false,
        error: "missing_log_text",
        message: "Provide logText in POST body or query.",
      });
    }

    try {
      console.info("DEBUG_RENDER_LOG_DIAG_START", {
        source,
        logChars: logText.length,
        includeFull,
      });

      const service = new RenderLogDiagnosisService();
      const diagnosis = await service.diagnose(logText, { source });

      console.info("DEBUG_RENDER_LOG_DIAG_END", {
        ok: true,
        source,
        kind: diagnosis?.fingerprint?.kind || "unknown",
        confidence: diagnosis?.correlation?.confidence || "very_low",
        topPath: diagnosis?.correlation?.topCandidate?.path || null,
        exactLine: diagnosis?.correlation?.lineWindow?.exactLine || null,
      });

      return res.status(200).json(buildDebugResponse(diagnosis, includeFull));
    } catch (error) {
      console.error("DEBUG_RENDER_LOG_DIAG_ERROR", {
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
  createDebugRenderLogDiagnosisRoute,
};