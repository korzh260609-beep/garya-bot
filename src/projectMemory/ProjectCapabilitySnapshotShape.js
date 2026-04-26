// src/projectMemory/ProjectCapabilitySnapshotShape.js
// ============================================================================
// PROJECT CAPABILITY SNAPSHOT SHAPE
// Stage: 7A.13 Project Capability Snapshot
//
// Purpose:
// - define the stable JSON shape for generated capability/status snapshots
// - keep snapshot constants/config separate from builder logic
// - make advisory/source-of-truth rules explicit and reusable
//
// Important:
// - This file has no DB writes.
// - This file has no Telegram command wiring.
// - This file has no runtime side effects.
// ============================================================================

export const PROJECT_CAPABILITY_SNAPSHOT_SCHEMA_VERSION = 1;

export const PROJECT_CAPABILITY_SNAPSHOT_TYPE = "project_capability_snapshot";

export const PROJECT_CAPABILITY_SOURCE_OF_TRUTH = "repo/runtime/tests";

export const PROJECT_CAPABILITY_ADVISORY_ONLY = true;

export const PROJECT_CAPABILITY_SNAPSHOT_NOTICE =
  "Generated capability snapshots are advisory status views, not authoritative source of truth.";

export const PROJECT_CAPABILITY_DEFAULT_PROJECT = Object.freeze({
  key: "SG",
  name: "Советник GARYA",
  stageKey: "7A.13",
});

export const PROJECT_CAPABILITY_DEFAULT_REPO_REF = "main";

export const PROJECT_CAPABILITY_STATUS = Object.freeze({
  UNKNOWN: "unknown",
  PLANNED: "planned",
  SKELETON: "skeleton",
  CONFIGURED: "configured",
  READ_ONLY: "read_only",
  RUNTIME_VERIFIED: "runtime_verified",
  BLOCKED: "blocked",
});

export const PROJECT_CAPABILITY_SNAPSHOT_REQUIRED_TOP_LEVEL_KEYS = Object.freeze([
  "schemaVersion",
  "builderVersion",
  "snapshotType",
  "generatedAt",
  "sourceOfTruth",
  "advisoryOnly",
  "notice",
  "project",
  "evidence",
  "capabilities",
  "limitations",
  "nextSafeStep",
]);

export const PROJECT_CAPABILITY_EVIDENCE_KEYS = Object.freeze([
  "repoRef",
  "verifiedFiles",
  "verifiedCommands",
  "verifiedCommits",
  "facts",
  "runtime",
  "tests",
]);

export const PROJECT_CAPABILITY_ITEM_KEYS = Object.freeze([
  "key",
  "title",
  "status",
  "userBenefit",
  "evidenceRefs",
  "limitations",
]);

export default {
  PROJECT_CAPABILITY_SNAPSHOT_SCHEMA_VERSION,
  PROJECT_CAPABILITY_SNAPSHOT_TYPE,
  PROJECT_CAPABILITY_SOURCE_OF_TRUTH,
  PROJECT_CAPABILITY_ADVISORY_ONLY,
  PROJECT_CAPABILITY_SNAPSHOT_NOTICE,
  PROJECT_CAPABILITY_DEFAULT_PROJECT,
  PROJECT_CAPABILITY_DEFAULT_REPO_REF,
  PROJECT_CAPABILITY_STATUS,
  PROJECT_CAPABILITY_SNAPSHOT_REQUIRED_TOP_LEVEL_KEYS,
  PROJECT_CAPABILITY_EVIDENCE_KEYS,
  PROJECT_CAPABILITY_ITEM_KEYS,
};
