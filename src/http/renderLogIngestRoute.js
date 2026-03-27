// src/http/renderLogIngestRoute.js
// ============================================================================
// STAGE SKELETON — protected ingest route for external render log watcher
// PURPOSE:
// - accept external error/deploy snapshots
// - save rolling error window
// - save last 10 deploy snapshots
// - optionally run diagnosis before storing
//
// PROTECTION:
// - RENDER_LOG_INGEST_ENABLED === "true"
// - token === RENDER_LOG_INGEST_TOKEN
//
// BODY EXAMPLES:
//
// Error mode:
// {
//   "sourceKey": "render_primary",
//   "mode": "error",
//   "logText": "SyntaxError: ...",
//   "meta": { "service": "sg-prod" }
// }
//
// Deploy mode:
// {
//   "sourceKey": "render_primary",
//   "mode": "deploy",
//   "deployId": "dep_123",
//   "status": "failed",
//   "logText": "SyntaxError: ...",
//   "meta": { "service": "sg-prod", "commit": "abc123" }
// }
// ============================================================================

import express from "express";
import RenderLogDiagnosisService from "../logging/RenderLogDiagnosisService.js";
import renderOpsStore from "../logging/RenderOpsStore.js";

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

function normalizeMeta(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return {};
  }
  return meta;
}

function buildErrorStoreInput(sourceKey, diagnosis, logText, meta) {
  return {
    sourceKey,
    severity: diagnosis?.fingerprint?.severity || "unknown",
    errorKind: diagnosis?.fingerprint?.kind || "unknown",
    errorHeadline: diagnosis?.fingerprint?.errorHeadline || "unknown",
    candidatePath: diagnosis?.correlation?.topCandidate?.path || null,
    exactLine: diagnosis?.correlation?.lineWindow?.exactLine || null,
    confidence: diagnosis?.correlation?.confidence || diagnosis?.fingerprint?.confidence || "very_low",
    logText,
    meta,
  };
}

function buildDeployStoreInput(sourceKey, deployId, status, diagnosis, logText, meta) {
  return {
    sourceKey,
    deployId,
    status,
    topError:
      diagnosis?.fingerprint?.errorHeadline ||
      normalizeString(meta?.topError) ||
      null,
    candidatePath: diagnosis?.correlation?.topCandidate?.path || null,
    exactLine: diagnosis?.correlation?.lineWindow?.exactLine || null,
    confidence: diagnosis?.correlation?.confidence || diagnosis?.fingerprint?.confidence || "very_low",
    logText,
    meta,
  };
}

export function createRenderLogIngestRoute() {
  const router = express.Router();

  router.post("/ingest/render-log", async (req, res) => {
    const enabled = isIngestEnabled();
    const expectedToken = getExpectedToken();
    const providedToken = getProvidedToken(req);

    if (!enabled || !expectedToken || providedToken !== expectedToken) {
      return res.status(403).json({
        ok: false,
        error: "forbidden",
      });
    }

    const sourceKey = normalizeString(req.body?.sourceKey || "render_primary") || "render_primary";
    const mode = normalizeMode(req.body?.mode);
    const logText = normalizeString(req.body?.logText || "");
    const meta = normalizeMeta(req.body?.meta);
    const deployId = normalizeString(req.body?.deployId || "");
    const status = normalizeString(req.body?.status || "unknown") || "unknown";

    if (!logText && mode === "error") {
      return res.status(400).json({
        ok: false,
        error: "missing_log_text",
      });
    }

    if (!deployId && mode === "deploy") {
      return res.status(400).json({
        ok: false,
        error: "missing_deploy_id",
      });
    }

    try {
      const diagnosisService = new RenderLogDiagnosisService();
      const shouldDiagnose = Boolean(logText);
      const diagnosis = shouldDiagnose
        ? await diagnosisService.diagnose(logText, {
            source: `render_ingest_${mode}`,
          })
        : null;

      if (mode === "error") {
        const storeResult = await renderOpsStore.addErrorSnapshot(
          buildErrorStoreInput(sourceKey, diagnosis, logText, meta)
        );

        return res.status(200).json({
          ok: true,
          mode,
          sourceKey,
          retentionLimit: storeResult.retentionLimit,
          storedId: storeResult?.row?.id || null,
          candidatePath: storeResult?.row?.candidate_path || null,
          exactLine: storeResult?.row?.exact_line || null,
          confidence: storeResult?.row?.confidence || "very_low",
        });
      }

      const storeResult = await renderOpsStore.upsertDeploySnapshot(
        buildDeployStoreInput(sourceKey, deployId, status, diagnosis, logText, meta)
      );

      return res.status(200).json({
        ok: true,
        mode,
        sourceKey,
        deployId,
        retentionLimit: storeResult.retentionLimit,
        storedId: storeResult?.row?.id || null,
        status: storeResult?.row?.status || status,
        topError: storeResult?.row?.top_error || null,
        candidatePath: storeResult?.row?.candidate_path || null,
        exactLine: storeResult?.row?.exact_line || null,
        confidence: storeResult?.row?.confidence || "very_low",
      });
    } catch (error) {
      console.error("❌ render log ingest failed:", error);

      return res.status(500).json({
        ok: false,
        error: "ingest_exception",
        message: error?.message ? String(error.message) : "unknown_error",
      });
    }
  });

  return router;
}

export default {
  createRenderLogIngestRoute,
};