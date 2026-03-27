// src/http/debugRenderLogIngestTestRoute.js
// ============================================================================
// PURPOSE:
// - allow browser-only testing of render ingest pipeline without terminal
// - protected by the SAME ingest env + token
// - creates a synthetic test snapshot and stores it through shared ingest logic
//
// HOW TO USE:
// GET /debug/render-log-ingest-test?token=...&mode=error
// GET /debug/render-log-ingest-test?token=...&mode=deploy&deployId=test_dep_001
//
// IMPORTANT:
// - developer-only route
// - fail-closed
// - no external Render access
// - no architecture redesign
// ============================================================================

import express from "express";
import { ingestRenderLogSnapshot } from "./renderLogIngestRoute.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isIngestEnabled() {
  return (
    String(process.env.RENDER_LOG_INGEST_ENABLED || "").trim().toLowerCase() === "true"
  );
}

function getExpectedToken() {
  return normalizeString(process.env.RENDER_LOG_INGEST_TOKEN || "");
}

function getProvidedToken(req) {
  const headerToken = normalizeString(req.headers["x-render-log-token"]);
  const queryToken = normalizeString(req.query.token);
  return headerToken || queryToken;
}

function normalizeMode(value) {
  const s = normalizeString(value).toLowerCase();
  if (s === "deploy") return "deploy";
  return "error";
}

function buildSyntheticErrorLog() {
  return [
    "SyntaxError: Missing catch or finally after try",
    "    at src/bot/messageRouter.js:420:1",
    "    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)",
  ].join("\n");
}

function buildSyntheticDeployLog() {
  return [
    "==> Build failed 😞",
    "SyntaxError: Missing catch or finally after try",
    "    at src/bot/messageRouter.js:420:1",
  ].join("\n");
}

export function createDebugRenderLogIngestTestRoute() {
  const router = express.Router();

  router.get("/debug/render-log-ingest-test", async (req, res) => {
    const enabled = isIngestEnabled();
    const expectedToken = getExpectedToken();
    const providedToken = getProvidedToken(req);

    if (!enabled || !expectedToken || providedToken !== expectedToken) {
      return res.status(403).json({
        ok: false,
        error: "forbidden",
      });
    }

    const mode = normalizeMode(req.query.mode);
    const sourceKey = normalizeString(req.query.sourceKey || "render_primary") || "render_primary";
    const deployId =
      normalizeString(req.query.deployId) ||
      `test_deploy_${Date.now()}`;
    const status = normalizeString(req.query.status || "failed") || "failed";

    const logText =
      mode === "deploy"
        ? buildSyntheticDeployLog()
        : buildSyntheticErrorLog();

    const meta = {
      service: "sg-debug-test-route",
      trigger: "browser_debug_route",
      synthetic: true,
    };

    try {
      const result = await ingestRenderLogSnapshot({
        sourceKey,
        mode,
        logText,
        meta,
        deployId,
        status,
        diagnosisSource: `debug_render_ingest_test_${mode}`,
      });

      if (!result.ok) {
        return res.status(result.statusCode || 400).json({
          ok: false,
          error: result.error || "ingest_test_validation_failed",
        });
      }

      return res.status(200).json({
        ok: true,
        testRoute: true,
        message: "Synthetic render ingest test snapshot stored.",
        request: {
          mode,
          sourceKey,
          deployId: mode === "deploy" ? deployId : null,
          status: mode === "deploy" ? status : null,
        },
        result: result.payload,
      });
    } catch (error) {
      console.error("❌ debug render ingest test failed:", error);

      return res.status(500).json({
        ok: false,
        error: "debug_ingest_test_exception",
        message: error?.message ? String(error.message) : "unknown_error",
      });
    }
  });

  return router;
}

export default {
  createDebugRenderLogIngestTestRoute,
};