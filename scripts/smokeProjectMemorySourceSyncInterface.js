// scripts/smokeProjectMemorySourceSyncInterface.js
// SG 2.0 — Project Memory Source Sync Interface smoke.
// Deterministic/offline: no DB, no GitHub, no Render, no Telegram, no AI, no live source sync.

import assert from "node:assert/strict";

import {
  buildProjectMemorySourceSyncInterfaceStatus,
  getProjectMemorySourceSyncInterfaceBoundaries,
  prepareProjectMemorySourceSync,
  PROJECT_MEMORY_SOURCE_SYNC_SOURCE_TYPES,
} from "../src/memory/index.js";

const status = buildProjectMemorySourceSyncInterfaceStatus();
assert.equal(status.ok, true);
assert.equal(status.service, "ProjectMemorySourceSyncInterface");
assert.equal(status.canPrepareCandidateDrafts, true);
assert.equal(status.canCreateDurableCandidates, false);
assert.equal(status.canConfirmCandidate, false);
assert.equal(status.canFetchSources, false);
assert.equal(status.canRunAutonomousSync, false);
assert.equal(status.canWriteStorage, false);
assert.equal(status.callsAI, false);
assert.equal(status.allowedSourceTypes.includes(PROJECT_MEMORY_SOURCE_SYNC_SOURCE_TYPES.PILLARS), true);
assert.equal(status.allowedSourceTypes.includes(PROJECT_MEMORY_SOURCE_SYNC_SOURCE_TYPES.REPO_EVIDENCE), true);
assert.equal(status.allowedSourceTypes.includes(PROJECT_MEMORY_SOURCE_SYNC_SOURCE_TYPES.RUNTIME_OBSERVATION), true);
assert.equal(status.allowedSourceTypes.includes(PROJECT_MEMORY_SOURCE_SYNC_SOURCE_TYPES.APPROVED_SESSION_SUMMARY), true);
assert.equal(status.allowedSourceTypes.includes(PROJECT_MEMORY_SOURCE_SYNC_SOURCE_TYPES.MANUAL_MONARCH_COMMAND), true);

const boundaries = getProjectMemorySourceSyncInterfaceBoundaries();
assert.equal(boundaries.transportIndependent, true);
assert.equal(boundaries.approvedSourcesOnly, true);
assert.equal(boundaries.allowlistedSourcesOnly, true);
assert.equal(boundaries.providedSourcesOnly, true);
assert.equal(boundaries.prefersSourceReferences, true);
assert.equal(boundaries.importsRawContent, false);
assert.equal(boundaries.importsRawLogs, false);
assert.equal(boundaries.importsSecrets, false);
assert.equal(boundaries.autonomousCronOrTimer, false);
assert.equal(boundaries.createsCandidateDrafts, true);
assert.equal(boundaries.createsDurableCandidates, false);
assert.equal(boundaries.confirmsCandidates, false);
assert.equal(boundaries.writesConfirmedMemory, false);
assert.equal(boundaries.readsStorage, false);
assert.equal(boundaries.writesStorage, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.fetchesGitHub, false);
assert.equal(boundaries.fetchesRender, false);
assert.equal(boundaries.fetchesWeb, false);
assert.equal(boundaries.fetchesSources, false);
assert.equal(boundaries.touchesTelegram, false);
assert.equal(boundaries.readsRawChat, false);
assert.equal(boundaries.autoWritesFromChat, false);
assert.equal(boundaries.autoWritesFromAI, false);
assert.equal(boundaries.promptInjection, false);
assert.equal(boundaries.modifiesRepository, false);
assert.equal(boundaries.writesRuntimeFiles, false);
assert.equal(boundaries.changesEnvironment, false);

const invalid = prepareProjectMemorySourceSync({ sources: "not-array" });
assert.equal(invalid.ok, false);
assert.equal(invalid.reason, "invalid_sources_input");
assert.equal(invalid.summary.sourcesChecked, 0);
assert.equal(invalid.candidates.length, 0);

const prepared = prepareProjectMemorySourceSync({
  sources: [
    {
      id: "pillar_plan_stage_18",
      sourceType: PROJECT_MEMORY_SOURCE_SYNC_SOURCE_TYPES.PILLARS,
      sourceRef: "pillars/modules/project_memory/DEVELOPMENT_PLAN.md#18-source-sync-interface",
      projectKey: "sg",
      scope: "project_memory",
      candidateType: "module_boundary",
      title: "Stage 18 source sync interface boundary",
      summary: "Create controlled source sync interface skeleton from approved sources.",
      content: "Raw content must be ignored and not copied into candidate drafts.",
    },
    {
      id: "repo_evidence_pr_280",
      sourceType: PROJECT_MEMORY_SOURCE_SYNC_SOURCE_TYPES.REPO_EVIDENCE,
      sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/280",
      projectKey: "sg",
      scope: "project_memory",
      candidateType: "implementation_status",
      title: "Stage 17 merged evidence",
      summary: "PR 280 merged conflict/stale detector skeleton.",
    },
    {
      id: "bad_source",
      sourceType: "web_live_fetch",
      sourceRef: "https://example.test/live",
      title: "Not allowlisted",
      summary: "Rejected because live source fetching is not allowed in skeleton.",
    },
    {
      id: "secret_source",
      sourceType: PROJECT_MEMORY_SOURCE_SYNC_SOURCE_TYPES.MANUAL_MONARCH_COMMAND,
      sourceRef: "manual://monarch/example",
      title: "Secret-like source",
      summary: "OPENAI_API_KEY=sk-example-secret-1234567890",
    },
    {
      id: "raw_log_source",
      sourceType: PROJECT_MEMORY_SOURCE_SYNC_SOURCE_TYPES.RUNTIME_OBSERVATION,
      sourceRef: "render://logs/example",
      title: "Raw log source",
      rawLog: true,
      summary: "Should be rejected because raw logs are not imported.",
    },
  ],
  options: {
    trustedPathApproved: true,
  },
});

assert.equal(prepared.ok, true);
assert.equal(prepared.summary.sourcesChecked, 5);
assert.equal(prepared.summary.acceptedSources, 2);
assert.equal(prepared.summary.rejectedSources, 3);
assert.equal(prepared.summary.candidateDraftsCreated, 2);
assert.equal(prepared.candidates.length, 2);
assert.equal(prepared.errors.length, 3);
assert.equal(prepared.errors.some((error) => error.code === "source_type_not_allowlisted"), true);
assert.equal(prepared.errors.some((error) => error.code === "secret_like_content_rejected"), true);
assert.equal(prepared.errors.some((error) => error.code === "raw_log_like_content_rejected"), true);
assert.equal(prepared.warnings.some((warning) => warning.code === "raw_content_ignored"), true);
assert.equal(prepared.warnings.some((warning) => warning.code === "trusted_path_ignored_in_skeleton"), true);

const firstCandidate = prepared.candidates[0];
assert.equal(firstCandidate.trust, "candidate");
assert.equal(firstCandidate.status, "pending_confirmation");
assert.equal(firstCandidate.sourceType, PROJECT_MEMORY_SOURCE_SYNC_SOURCE_TYPES.PILLARS);
assert.equal(firstCandidate.sourceRef, "pillars/modules/project_memory/DEVELOPMENT_PLAN.md#18-source-sync-interface");
assert.equal(firstCandidate.sourceMetadata.importedRawContent, false);
assert.equal(firstCandidate.sourceMetadata.importedRawLogs, false);
assert.equal(firstCandidate.sourceMetadata.importedSecrets, false);
assert.equal(Object.prototype.hasOwnProperty.call(firstCandidate, "content"), false);
assert.equal(Object.prototype.hasOwnProperty.call(firstCandidate, "rawContent"), false);

assert.equal(prepared.boundaries.readsStorage, false);
assert.equal(prepared.boundaries.writesStorage, false);
assert.equal(prepared.boundaries.callsAI, false);
assert.equal(prepared.boundaries.touchesTelegram, false);
assert.equal(prepared.boundaries.fetchesGitHub, false);
assert.equal(prepared.boundaries.fetchesRender, false);
assert.equal(prepared.boundaries.fetchesWeb, false);
assert.equal(prepared.boundaries.fetchesSources, false);
assert.equal(prepared.boundaries.modifiesRepository, false);
assert.equal(prepared.boundaries.writesRuntimeFiles, false);
assert.equal(prepared.boundaries.changesEnvironment, false);
assert.equal(prepared.boundaries.writesConfirmedMemory, false);
assert.equal(prepared.boundaries.confirmsCandidates, false);

console.log("smokeProjectMemorySourceSyncInterface: ok");
