// scripts/smokeRenderEvidenceBridge.js
// SG 2.0 — Render Evidence Bridge smoke.
// Deterministic/offline: injected client only, no real Render API, no DB, no Telegram, no AI.

import assert from "node:assert/strict";

import {
  buildRenderEvidenceBridgeStatus,
  getRenderEvidenceBridgeBoundaries,
  RenderEvidenceBridge,
} from "../src/integrations/render/RenderEvidenceBridge.js";
import {
  getRenderEvidenceConfig,
  getRenderEvidenceDiag,
} from "../src/integrations/render/RenderEvidenceConfig.js";

const env = {
  RENDER_EVIDENCE_ENABLED: "true",
  RENDER_API_KEY: "secret-render-key-must-not-leak",
  RENDER_SERVICE_ID: "srv_garya_bot",
  RENDER_OWNER_ID: "owner_garya",
  RENDER_EVIDENCE_LOG_LIMIT: "100",
};

const config = getRenderEvidenceConfig(env);
assert.equal(config.enabled, true);
assert.equal(config.ready, true);
assert.equal(config.apiKey, "secret-render-key-must-not-leak");
assert.equal(config.serviceId, "srv_garya_bot");

const diag = getRenderEvidenceDiag(env);
assert.equal(diag.enabled, true);
assert.equal(diag.ready, true);
assert.equal(diag.hasApiKey, true);
assert.equal(Object.prototype.hasOwnProperty.call(diag, "apiKey"), false);
assert.equal(JSON.stringify(diag).includes("secret-render-key-must-not-leak"), false);

const status = buildRenderEvidenceBridgeStatus({ env });
assert.equal(status.ok, true);
assert.equal(status.service, "RenderEvidenceBridge");
assert.equal(status.ready, true);
assert.equal(status.hasApiKey, true);
assert.equal(JSON.stringify(status).includes("secret-render-key-must-not-leak"), false);

const boundaries = getRenderEvidenceBridgeBoundaries();
assert.equal(boundaries.sourceEvidenceOnly, true);
assert.equal(boundaries.sanitizedOutputOnly, true);
assert.equal(boundaries.emitsRawLogs, false);
assert.equal(boundaries.emitsSecrets, false);
assert.equal(boundaries.writesProjectMemory, false);
assert.equal(boundaries.writesRuntimeFiles, false);
assert.equal(boundaries.writesRepository, false);
assert.equal(boundaries.changesEnvironment, false);
assert.equal(boundaries.touchesTelegram, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.canUseInjectedClient, true);

const cleanClient = {
  async listDeploys() {
    return [
      {
        id: "dep_clean",
        status: "live",
        commit: { id: "abc123" },
        createdAt: "2026-05-16T13:00:00Z",
        finishedAt: "2026-05-16T13:02:00Z",
      },
    ];
  },
  async listLogs() {
    return [
      {
        timestamp: "2026-05-16T13:01:00Z",
        level: "info",
        message: "Server started",
      },
    ];
  },
};

const cleanBridge = new RenderEvidenceBridge({
  config,
  client: cleanClient,
});

const clean = await cleanBridge.collectDeployLogsEvidence({
  serviceId: "srv_garya_bot",
  ownerId: "owner_garya",
  commit: "abc123",
});

assert.equal(clean.ok, true);
assert.equal(clean.evidence.eventType, "deploy_ok");
assert.equal(clean.evidence.verified, true);
assert.equal(clean.evidence.deployOk, true);
assert.equal(clean.evidence.logsClean, true);
assert.equal(clean.evidence.errorCount, 0);
assert.equal(clean.evidence.logsChecked, 0);
assert.equal(clean.evidence.policy, "automatic_project_evidence_chain");
assert.equal(clean.evidence.sourceRef, "render://deploy/dep_clean");
assert.equal(clean.evidence.sanitized, true);
assert.equal(JSON.stringify(clean).includes("Server started"), false);
assert.equal(clean.boundaries.emitsRawLogs, false);
assert.equal(clean.boundaries.writesProjectMemory, false);

const errorClient = {
  async listDeploys() {
    return [
      {
        id: "dep_error",
        status: "live",
        commit: "def456",
        createdAt: "2026-05-16T14:00:00Z",
        finishedAt: "2026-05-16T14:02:00Z",
      },
    ];
  },
  async listLogs() {
    return [
      {
        timestamp: "2026-05-16T14:01:00Z",
        level: "error",
        message: "DATABASE_URL=postgres://secret must not leak; app failed",
      },
    ];
  },
};

const errorBridge = new RenderEvidenceBridge({
  config,
  client: errorClient,
});

const failed = await errorBridge.collectDeployLogsEvidence({
  serviceId: "srv_garya_bot",
  ownerId: "owner_garya",
  commit: "def456",
});

assert.equal(failed.ok, true);
assert.equal(failed.evidence.eventType, "deploy_check_failed");
assert.equal(failed.evidence.verified, false);
assert.equal(failed.evidence.deployOk, true);
assert.equal(failed.evidence.logsClean, false);
assert.equal(failed.evidence.errorCount, 1);
assert.equal(failed.evidence.logsChecked, 1);
assert.equal(failed.warnings.some((warning) => warning.code === "render_logs_not_clean"), true);
assert.equal(JSON.stringify(failed).includes("DATABASE_URL"), false);
assert.equal(JSON.stringify(failed).includes("postgres://secret"), false);

const noDeployBridge = new RenderEvidenceBridge({
  config,
  client: {
    async listDeploys() {
      return [];
    },
    async listLogs() {
      return [];
    },
  },
});

const noDeploy = await noDeployBridge.collectDeployLogsEvidence({
  serviceId: "srv_garya_bot",
});
assert.equal(noDeploy.ok, false);
assert.equal(noDeploy.reason, "render_deploy_not_found");
assert.equal(noDeploy.evidence, null);

console.log("smokeRenderEvidenceBridge: ok");
