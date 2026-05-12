// scripts/smokeProjectMemorySkeleton.js
// SG 2.0 — Project Memory V1 runtime skeleton smoke.
// This smoke must stay deterministic, offline, and side-effect free.

import assert from "node:assert/strict";
import {
  PROJECT_MEMORY_SCOPES,
  PROJECT_MEMORY_SOURCE_TYPES,
  PROJECT_MEMORY_TRUST,
  PROJECT_MEMORY_TYPES,
  ProjectMemoryService,
  getMemoryModuleStatus,
} from "../src/memory/index.js";

function assertWarning(result, code) {
  assert.ok(
    Array.isArray(result.warnings) && result.warnings.some((warning) => warning.code === code),
    `expected warning ${code}`
  );
}

function assertError(result, code) {
  assert.ok(
    Array.isArray(result.errors) && result.errors.some((error) => error.code === code),
    `expected error ${code}`
  );
}

const service = new ProjectMemoryService({ logger: { log() {}, warn() {}, error() {} } });

const moduleStatus = getMemoryModuleStatus();
assert.equal(moduleStatus.ok, true);
assert.equal(moduleStatus.runtimeConnected, false);
assert.equal(moduleStatus.hasDb, false);
assert.equal(moduleStatus.hasAICalls, false);
assert.equal(moduleStatus.hasSourceFetching, false);
assert.equal(moduleStatus.principles.sourceFirst, true);

const status = service.status();
assert.equal(status.ok, true);
assert.equal(status.enabled, true);
assert.equal(status.mode, "read_only_prepare_only_runtime_skeleton");
assert.equal(status.hasDb, false);
assert.equal(status.hasRuntimeConnection, false);
assert.equal(status.canReadStorage, false);
assert.equal(status.canWriteStorage, false);
assert.equal(status.canFetchSources, false);
assert.equal(status.canCallAI, false);
assert.equal(status.canBuildCandidates, true);
assert.equal(status.canValidateCandidates, true);
assert.equal(status.canSelectProvidedContext, true);
assert.equal(status.canBuildContextItems, true);
assert.equal(status.durableWritesEnabled, false);
assert.equal(status.confirmationRequiredForDurableMemory, true);

const diagnostics = service.getDiagnostics();
assert.equal(diagnostics.ok, true);
assert.equal(diagnostics.module, "project_memory");
assert.equal(diagnostics.service, "ProjectMemoryService");
assert.equal(diagnostics.mode, "runtime_skeleton");
assert.equal(diagnostics.storage.hasDb, false);
assert.equal(diagnostics.storage.canReadStorage, false);
assert.equal(diagnostics.storage.canWriteStorage, false);
assert.equal(diagnostics.sideEffects.fetchesSources, false);
assert.equal(diagnostics.sideEffects.callsAI, false);
assert.equal(diagnostics.sideEffects.touchesTransport, false);
assert.equal(diagnostics.sideEffects.modifiesRepository, false);
assert.equal(diagnostics.sideEffects.writesRuntime, false);
assert.ok(diagnostics.supportedActions.includes("buildCandidate"));
assert.ok(diagnostics.blockedActions.includes("db_write"));
assert.ok(diagnostics.blockedActions.includes("ai_auto_write"));

const candidate = service.buildCandidate({
  type: PROJECT_MEMORY_TYPES.ARCHITECTURE_DECISION,
  title: "Project Memory stays below verified sources",
  content: "Project Memory supports context but never overrides pillars, repo facts, runtime facts, or Monarch decisions.",
  scope: PROJECT_MEMORY_SCOPES.GLOBAL_PROJECT,
  sourceType: PROJECT_MEMORY_SOURCE_TYPES.MONARCH_APPROVAL,
  sourceRef: "smoke:test",
  tags: ["project_memory", " source_first ", "project_memory"],
});
assert.equal(candidate.ok, true);
assert.equal(candidate.mode, "prepare_only");
assert.equal(candidate.item.trust, PROJECT_MEMORY_TRUST.CANDIDATE);
assert.equal(candidate.item.type, PROJECT_MEMORY_TYPES.ARCHITECTURE_DECISION);
assert.equal(candidate.item.scope, PROJECT_MEMORY_SCOPES.GLOBAL_PROJECT);
assert.deepEqual(candidate.item.tags, ["project_memory", "source_first"]);
assert.equal(candidate.validation.ok, true);
assert.equal(candidate.validation.requiresApproval, true);

const missingContent = service.buildCandidate({
  title: "Missing content candidate",
  content: "",
  sourceType: PROJECT_MEMORY_SOURCE_TYPES.MONARCH_APPROVAL,
});
assert.equal(missingContent.ok, false);
assertWarning(missingContent, "missing_content");
assertError(missingContent, "missing_content");

const missingSource = service.buildCandidate({
  title: "Candidate with no source",
  content: "This should remain only a candidate and warn about missing source.",
  sourceType: null,
  sourceRef: null,
});
assert.equal(missingSource.validation.ok, true);
assertWarning(missingSource.validation, "missing_source_reference");

const secretCandidate = service.buildCandidate({
  title: "Secret candidate",
  content: "DATABASE_URL=postgres://user:pass@example/db must never be stored as Project Memory.",
  sourceType: PROJECT_MEMORY_SOURCE_TYPES.MONARCH_APPROVAL,
});
assert.equal(secretCandidate.validation.ok, false);
assertError(secretCandidate.validation, "contains_secret");

const rawEnvCandidate = service.buildCandidate({
  title: "Raw env dump",
  content: "Raw env output must not become project memory.",
  sourceType: "raw_env",
});
assert.equal(rawEnvCandidate.validation.ok, false);
assertError(rawEnvCandidate.validation, "blocked_raw_source_type");

const invalidNormalize = service.normalizeProvidedItems("not-array");
assert.equal(invalidNormalize.ok, false);
assertWarning(invalidNormalize, "invalid_items_input");

const normalized = service.normalizeProvidedItems([
  {
    type: "unknown_type",
    title: "  Normalized title  ",
    content: "Normalized content",
    scope: "unknown_scope",
    trust: "unknown_trust",
    sourceType: PROJECT_MEMORY_SOURCE_TYPES.PR,
    sourceRef: "#120",
    tags: [" a ", "a", "b"],
  },
]);
assert.equal(normalized.ok, true);
assert.equal(normalized.items.length, 1);
assert.equal(normalized.items[0].type, PROJECT_MEMORY_TYPES.ARCHITECTURE_DECISION);
assert.equal(normalized.items[0].scope, PROJECT_MEMORY_SCOPES.GLOBAL_PROJECT);
assert.equal(normalized.items[0].trust, PROJECT_MEMORY_TRUST.CANDIDATE);
assert.deepEqual(normalized.items[0].tags, ["a", "b"]);

const manyItems = Array.from({ length: 5 }, (_, index) => ({
  type: PROJECT_MEMORY_TYPES.IMPLEMENTATION_STATUS,
  title: `Status ${index + 1}`,
  content: `Project Memory status item ${index + 1}`,
  scope: PROJECT_MEMORY_SCOPES.MODULE,
  trust: PROJECT_MEMORY_TRUST.CANDIDATE,
  sourceType: PROJECT_MEMORY_SOURCE_TYPES.PR,
  sourceRef: `#${120 + index}`,
}));

const selected = service.selectForContext({ items: manyItems, limit: 2, maxContentChars: 120 });
assert.equal(selected.ok, true);
assert.equal(selected.items.length, 2);
assert.equal(selected.limits.applied, 2);
assert.equal(selected.limits.maxContentChars, 120);

const contextItems = service.buildContextItems({ items: manyItems, limit: 3, maxContentChars: 60 });
assert.equal(contextItems.ok, true);
assert.equal(contextItems.items.length, 3);
for (const item of contextItems.items) {
  assert.equal(item.type, "project_memory");
  assert.equal(item.priority, "below_verified_sources");
  assert.equal(item.owner, "sg_project");
  assert.ok(item.metadata.projectMemoryType);
  assert.ok(item.metadata.title);
}

console.log("smokeProjectMemorySkeleton: ok");
