// scripts/smokeRenderEvidenceRuntimeInvocationBridge.js
// SG 2.0 — Render Evidence Runtime Invocation Bridge smoke.
// Deterministic/offline: injected Render client and fake Project Memory confirmation only.
// No real Render API, no DB requirement, no Telegram, no AI, no raw logs/secrets.

import assert from "node:assert/strict";

import {
  RenderEvidenceBridge,
} from "../src/integrations/render/RenderEvidenceBridge.js";
import {
  getRenderEvidenceConfig,
} from "../src/integrations/render/RenderEvidenceConfig.js";
import {
  RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_VERSION,
  buildRenderEvidenceRuntimeInvocationBridgeStatus,
  getRenderEvidenceRuntimeInvocationBridgeBoundaries,
  runRenderEvidenceRuntimeInvocationBridge,
} from "../src/integrations/render/RenderEvidenceRuntimeInvocationBridge.js";

const env = {
  RENDER_EVIDENCE_ENABLED: "true",
  RENDER_API_KEY: "secret-render-key-must-not-leak",
  RENDER_SERVICE_ID: "srv_garya_bot",
  RENDER_OWNER_ID: "owner_garya",
  RENDER_EVIDENCE_LOG_LIMIT: "100",
};

const config = getRenderEvidenceConfig(env);

const boundaries = getRenderEvidenceRuntimeInvocationBridgeBoundaries();
assert.equal(boundaries.transportIndependent, true);
assert.equal(boundaries.explicitRuntimeInvocationRequestOnly, true);
assert.equal(boundaries.connectsRenderEvidenceBridgeToProjectMemoryRuntimeTrustedEventTool, true);
assert.equal(boundaries.fetchesRenderOnlyThroughRenderEvidenceBridge, true);
assert.equal(boundaries.projectMemoryReceivesSanitizedEvidenceOnly, true);
assert.equal(boundaries.writesRuntimeFiles, false);
assert.equal(boundaries.writesRepository, false);
assert.equal(boundaries.changesEnvironment, false);
assert.equal(boundaries.touchesTelegram, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.emitsRawLogs, false);
assert.equal(boundaries.emitsSecrets, false);

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
        message: "Server started cleanly and must not appear in output",
      },
    ];
  },
};

const cleanRenderBridge = new RenderEvidenceBridge({
  config,
  client: cleanClient,
});

const status = buildRenderEvidenceRuntimeInvocationBridgeStatus({ renderBridge: cleanRenderBridge });
assert.equal(status.ok, true);
assert.equal(status.service, "RenderEvidenceRuntimeInvocationBridge");
assert.equal(status.version, RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_VERSION);
assert.equal(status.canCollectRenderEvidence, true);
assert.equal(status.canDispatchToProjectMemoryRuntimeTrustedEventTool, true);
assert.equal(status.renderEvidenceReady, true);
assert.equal(status.renderEvidenceEnabled, true);
assert.equal(JSON.stringify(status).includes("secret-render-key-must-not-leak"), false);

const fakeConfirmation = {
  async prepareCandidateForConfirmation({ input, createdBy, projectKey, traceId, actor }) {
    assert.equal(input.type, "implementation_status");
    assert.equal(input.title, "Render deploy checked clean — abc123");
    assert.equal(input.sourceRef, "render://deploy/dep_clean");
    assert.equal(input.metadata.sourceKind, "render_deploy_logs");
    assert.equal(input.metadata.eventType, "deploy_ok");
    assert.equal(input.metadata.verified, true);
    assert.equal(input.metadata.deployOk, true);
    assert.equal(input.metadata.logsClean, true);
    assert.equal(input.metadata.errorCount, 0);
    assert.equal(createdBy, "smoke-render-evidence-runtime-invocation-bridge");
    assert.equal(projectKey, "sg");
    assert.equal(traceId, "pmtrace_smoke_render_evidence_runtime_invocation_bridge");
    assert.equal(actor.role, "system");

    return {
      ok: true,
      mode: "explicit_only",
      decision: "candidate_created_for_confirmation",
      stored: true,
      requiresConfirmation: true,
      candidate: {
        ok: true,
        item: input,
      },
      entry: {
        id: "pm_smoke_render_runtime_invocation_bridge",
        projectKey,
        title: input.title,
        trust: "candidate",
        status: "pending_confirmation",
      },
      traceId,
    };
  },

  async confirmCandidate({ entryId, confirmedBy, traceId, approvalRef }) {
    assert.equal(entryId, "pm_smoke_render_runtime_invocation_bridge");
    assert.equal(confirmedBy, "system");
    assert.equal(traceId, "pmtrace_smoke_render_evidence_runtime_invocation_bridge");
    assert.equal(approvalRef, "render://deploy/dep_clean");

    return {
      ok: true,
      entry: {
        id: entryId,
        trust: "confirmed",
        status: "active",
      },
      trust: "confirmed",
      traceId,
      approvalRef,
    };
  },
};

const missingExplicit = await runRenderEvidenceRuntimeInvocationBridge({
  request: {},
  actor: { role: "system" },
  renderBridge: cleanRenderBridge,
  confirmation: fakeConfirmation,
});
assert.equal(missingExplicit.ok, false);
assert.equal(missingExplicit.reason, "missing_explicit_render_evidence_runtime_invocation_request");
assert.equal(missingExplicit.dispatched, false);
assert.equal(missingExplicit.evidenceCollected, false);

const confirmed = await runRenderEvidenceRuntimeInvocationBridge({
  request: {
    explicitRenderEvidenceRuntimeInvocationRequest: true,
    serviceId: "srv_garya_bot",
    ownerId: "owner_garya",
    commit: "abc123",
    traceId: "pmtrace_smoke_render_evidence_runtime_invocation_bridge",
  },
  actor: { role: "system", isMonarch: false },
  renderBridge: cleanRenderBridge,
  confirmation: fakeConfirmation,
  createdBy: "smoke-render-evidence-runtime-invocation-bridge",
});

assert.equal(confirmed.ok, true);
assert.equal(confirmed.dispatched, true);
assert.equal(confirmed.evidenceCollected, true);
assert.equal(confirmed.trustedToolDispatched, true);
assert.equal(confirmed.trustedEventCreated, true);
assert.equal(confirmed.candidatePrepared, true);
assert.equal(confirmed.stored, true);
assert.equal(confirmed.confirmed, true);
assert.equal(confirmed.requiresConfirmation, false);
assert.equal(confirmed.evidence.eventType, "deploy_ok");
assert.equal(confirmed.evidence.verified, true);
assert.equal(confirmed.evidence.sanitized, true);
assert.equal(confirmed.trustedToolResult.confirmed, true);
assert.equal(confirmed.entry.trust, "confirmed");
assert.equal(confirmed.boundaries.projectMemoryReceivesSanitizedEvidenceOnly, true);
assert.equal(confirmed.trustedToolResult.boundaries.fetchesRender, false);
assert.equal(JSON.stringify(confirmed).includes("Server started cleanly"), false);
assert.equal(JSON.stringify(confirmed).includes("secret-render-key-must-not-leak"), false);

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

const errorRenderBridge = new RenderEvidenceBridge({
  config,
  client: errorClient,
});

const rejected = await runRenderEvidenceRuntimeInvocationBridge({
  request: {
    explicitRenderEvidenceRuntimeInvocationRequest: true,
    serviceId: "srv_garya_bot",
    ownerId: "owner_garya",
    commit: "def456",
    traceId: "pmtrace_smoke_render_evidence_runtime_invocation_bridge_rejected",
  },
  actor: { role: "system", isMonarch: false },
  renderBridge: errorRenderBridge,
  confirmation: fakeConfirmation,
  createdBy: "smoke-render-evidence-runtime-invocation-bridge",
});

assert.equal(rejected.ok, false);
assert.equal(rejected.evidenceCollected, true);
assert.equal(rejected.trustedToolDispatched, false);
assert.equal(rejected.trustedEventCreated, false);
assert.equal(rejected.confirmed, false);
assert.equal(rejected.reason, "render_evidence_not_verified_deploy_ok");
assert.equal(rejected.evidence.eventType, "deploy_check_failed");
assert.equal(rejected.evidence.verified, false);
assert.equal(rejected.evidence.logsClean, false);
assert.equal(JSON.stringify(rejected).includes("DATABASE_URL"), false);
assert.equal(JSON.stringify(rejected).includes("postgres://secret"), false);

console.log("smokeRenderEvidenceRuntimeInvocationBridge: ok");
