// scripts/smokeProjectMemoryTrustedEventSource.js
// SG 2.0 — Project Memory trusted event source smoke.
// This smoke must stay deterministic, offline, and must not touch DB/network/AI/transport/runtime.

import assert from "node:assert/strict";

import {
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES,
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_DECISIONS,
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS,
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_MODES,
  buildProjectMemoryTrustedEventSourceStatus,
  createTrustedProjectEventForPrMerged,
  createTrustedProjectEventForRenderDeployEvidence,
  getProjectMemoryTrustedEventSourceBoundaries,
  normalizeTrustedProjectEvent,
} from "../src/memory/index.js";

const status = buildProjectMemoryTrustedEventSourceStatus();
assert.equal(status.ok, true);
assert.equal(status.mode, PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_MODES.NORMALIZE_TRUSTED_EVENTS_ONLY);
assert.equal(status.canCreatePrMergedTrustedEvent, true);
assert.equal(status.canCreateRenderDeployLogsTrustedEvent, true);
assert.equal(status.canCallAutomaticOrchestrator, false);
assert.equal(status.prMergedTrustedEventRequestsAutoConfirm, true);
assert.equal(status.renderDeployLogsTrustedEventRequestsAutoConfirm, true);
assert.deepEqual(status.supportedEventTypes, [
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED,
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.DEPLOY_OK,
]);
assert.equal(status.supportedSourceKinds.includes(PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED), true);
assert.equal(status.supportedSourceKinds.includes(PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.RENDER_DEPLOY_LOGS), true);

const boundaries = getProjectMemoryTrustedEventSourceBoundaries();
assert.equal(boundaries.transportIndependent, true);
assert.equal(boundaries.trustedSystemEventsOnly, true);
assert.equal(boundaries.normalizesEventsOnly, true);
assert.equal(boundaries.callsAutomaticOrchestrator, false);
assert.equal(boundaries.createsDurableCandidate, false);
assert.equal(boundaries.confirmsCandidates, false);
assert.equal(boundaries.writesConfirmedMemory, false);
assert.equal(boundaries.writesStorage, false);
assert.equal(boundaries.readsStorage, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.readsRawChat, false);
assert.equal(boundaries.fetchesGitHub, false);
assert.equal(boundaries.fetchesRender, false);
assert.equal(boundaries.fetchesSources, false);
assert.equal(boundaries.sourceSync, false);
assert.equal(boundaries.promptInjection, false);
assert.equal(boundaries.touchesTelegram, false);
assert.equal(boundaries.modifiesRepository, false);
assert.equal(boundaries.writesRuntimeFiles, false);

const normalized = normalizeTrustedProjectEvent({
  event: {
    type: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED,
    title: "  PR merged  ",
    content: "  Trusted project event created.  ",
    url: "  https://github.com/korzh260609-beep/garya-bot/pull/257  ",
    tags: [" project_memory ", "", null],
    metadata: { ok: true },
  },
});
assert.equal(normalized.eventType, PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED);
assert.equal(normalized.title, "PR merged");
assert.equal(normalized.summary, "Trusted project event created.");
assert.equal(normalized.sourceRef, "https://github.com/korzh260609-beep/garya-bot/pull/257");
assert.equal(normalized.projectKey, "sg");
assert.deepEqual(normalized.tags, ["project_memory"]);
assert.deepEqual(normalized.metadata, { ok: true });

const prMerged = createTrustedProjectEventForPrMerged({
  request: { explicitTrustedEventSourceRequest: true },
  pr: {
    number: 257,
    title: "project-memory: add automatic orchestrator",
    sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/257",
    repositoryFullName: "korzh260609-beep/garya-bot",
    baseBranch: "dev/v2-start",
    headSha: "aec32dbf3830a526e07e348ea8d0d635bfc731b5",
    mergedAt: "2026-05-16T00:00:00Z",
  },
});

assert.equal(prMerged.ok, true);
assert.equal(prMerged.decision, PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_DECISIONS.TRUSTED_EVENT_CREATED);
assert.equal(prMerged.sourceKind, PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED);
assert.equal(prMerged.trustedEventCreated, true);
assert.equal(prMerged.requiresAutomaticOrchestrator, true);
assert.equal(prMerged.event.eventType, PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED);
assert.equal(prMerged.event.title, "PR #257 merged — project-memory: add automatic orchestrator");
assert.equal(prMerged.event.summary, "Merged PR #257: project-memory: add automatic orchestrator");
assert.equal(prMerged.event.sourceRef, "https://github.com/korzh260609-beep/garya-bot/pull/257");
assert.equal(prMerged.event.projectKey, "sg");
assert.equal(prMerged.event.moduleKey, "project_memory");
assert.equal(prMerged.event.stageKey, "stage_07_memory");
assert.equal(prMerged.event.metadata.repositoryFullName, "korzh260609-beep/garya-bot");
assert.equal(prMerged.event.metadata.prNumber, 257);
assert.equal(prMerged.event.metadata.baseBranch, "dev/v2-start");
assert.equal(prMerged.suggestedOrchestratorRequest.explicitAutomaticMemoryRequest, true);
assert.equal(prMerged.suggestedOrchestratorRequest.autoConfirm, true);
assert.equal(prMerged.suggestedOrchestratorRequest.evidence.eventType, PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED);
assert.equal(prMerged.suggestedOrchestratorRequest.evidence.sourceRef, "https://github.com/korzh260609-beep/garya-bot/pull/257");
assert.equal(prMerged.suggestedOrchestratorRequest.evidence.approvalRef, "https://github.com/korzh260609-beep/garya-bot/pull/257");
assert.equal(prMerged.suggestedOrchestratorRequest.evidence.verified, true);
assert.deepEqual(prMerged.errors, []);
assert.deepEqual(prMerged.warnings, []);

const renderDeploy = createTrustedProjectEventForRenderDeployEvidence({
  request: { explicitTrustedEventSourceRequest: true },
  evidence: {
    sourceKind: "render_deploy_logs",
    eventType: "deploy_ok",
    sourceRef: "render://deploy/dep_clean",
    approvalRef: "render://deploy/dep_clean",
    policy: "automatic_project_evidence_chain",
    verified: true,
    deployOk: true,
    logsClean: true,
    errorCount: 0,
    logsChecked: 100,
    deployId: "dep_clean",
    commit: "45718465a93500fae0f53862c75d463c447c66b9",
    deployStatus: "live",
    sanitized: true,
  },
});

assert.equal(renderDeploy.ok, true);
assert.equal(renderDeploy.decision, PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_DECISIONS.TRUSTED_EVENT_CREATED);
assert.equal(renderDeploy.sourceKind, PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.RENDER_DEPLOY_LOGS);
assert.equal(renderDeploy.trustedEventCreated, true);
assert.equal(renderDeploy.event.eventType, PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.DEPLOY_OK);
assert.equal(renderDeploy.event.title, "Render deploy checked clean — 45718465a93500fae0f53862c75d463c447c66b9");
assert.equal(renderDeploy.event.sourceRef, "render://deploy/dep_clean");
assert.equal(renderDeploy.event.metadata.verified, true);
assert.equal(renderDeploy.event.metadata.deployOk, true);
assert.equal(renderDeploy.event.metadata.logsClean, true);
assert.equal(renderDeploy.suggestedOrchestratorRequest.autoConfirm, true);
assert.equal(renderDeploy.suggestedOrchestratorRequest.evidence.verified, true);
assert.equal(renderDeploy.suggestedOrchestratorRequest.evidence.policy, "automatic_project_evidence_chain");

const renderFailed = createTrustedProjectEventForRenderDeployEvidence({
  request: { explicitTrustedEventSourceRequest: true },
  evidence: {
    sourceKind: "render_deploy_logs",
    eventType: "deploy_check_failed",
    sourceRef: "render://deploy/dep_error",
    policy: "automatic_project_evidence_chain",
    verified: false,
    deployOk: true,
    logsClean: false,
    errorCount: 1,
  },
});
assert.equal(renderFailed.ok, false);
assert.equal(renderFailed.reason, "render_evidence_not_verified_deploy_ok");
assert.equal(renderFailed.trustedEventCreated, false);
assert.equal(renderFailed.event, null);

const missingExplicit = createTrustedProjectEventForPrMerged({
  pr: {
    number: 257,
    title: "project-memory: add automatic orchestrator",
    sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/257",
  },
});
assert.equal(missingExplicit.ok, false);
assert.equal(missingExplicit.reason, "missing_explicit_trusted_event_source_request");
assert.equal(missingExplicit.trustedEventCreated, false);
assert.equal(missingExplicit.event, null);

const missingEvidence = createTrustedProjectEventForPrMerged({
  request: { explicitTrustedEventSourceRequest: true },
  pr: {
    number: 257,
    title: "",
    sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/257",
  },
});
assert.equal(missingEvidence.ok, false);
assert.equal(missingEvidence.reason, "missing_required_pr_merged_evidence");
assert.equal(missingEvidence.trustedEventCreated, false);
assert.equal(missingEvidence.event, null);

const wrongBase = createTrustedProjectEventForPrMerged({
  request: { explicitTrustedEventSourceRequest: true },
  pr: {
    number: 258,
    title: "test wrong base",
    sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/258",
    baseBranch: "main",
  },
});
assert.equal(wrongBase.ok, true);
assert.equal(wrongBase.suggestedOrchestratorRequest.autoConfirm, true);
assert.equal(wrongBase.warnings.length, 1);
assert.equal(wrongBase.warnings[0].code, "unexpected_base_branch");

console.log("smokeProjectMemoryTrustedEventSource: ok");
