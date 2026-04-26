// src/projectMemory/ProjectCapabilitySnapshotBuilder.js
// ============================================================================
// PROJECT CAPABILITY SNAPSHOT BUILDER
// Stage: 7A.13 Project Capability Snapshot
//
// Purpose:
// - build a generated, read-only capability/status snapshot from supplied facts
// - keep snapshot generation separate from ProjectMemoryService writes
// - make source-of-truth rules explicit in every snapshot
//
// Important:
// - This file has no DB writes.
// - This file has no Telegram command wiring.
// - This file does not read repo/runtime by itself.
// - Caller must supply verified repo/runtime/test facts.
// ============================================================================

import {
  PROJECT_CAPABILITY_ADVISORY_ONLY,
  PROJECT_CAPABILITY_DEFAULT_PROJECT,
  PROJECT_CAPABILITY_DEFAULT_REPO_REF,
  PROJECT_CAPABILITY_SNAPSHOT_NOTICE,
  PROJECT_CAPABILITY_SNAPSHOT_SCHEMA_VERSION,
  PROJECT_CAPABILITY_SNAPSHOT_TYPE,
  PROJECT_CAPABILITY_SOURCE_OF_TRUTH,
  PROJECT_CAPABILITY_STATUS,
} from "./ProjectCapabilitySnapshotShape.js";

export const PROJECT_CAPABILITY_SNAPSHOT_BUILDER_VERSION =
  "project-capability-snapshot-builder-7A13-shape-2026-04-26-01";

function normalizeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function normalizeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

export function buildProjectCapabilitySnapshot(input = {}) {
  const facts = normalizeObject(input.facts);
  const runtime = normalizeObject(input.runtime);
  const tests = normalizeObject(input.tests);
  const capabilities = Array.isArray(input.capabilities)
    ? input.capabilities
    : [];

  return {
    schemaVersion: PROJECT_CAPABILITY_SNAPSHOT_SCHEMA_VERSION,
    builderVersion: PROJECT_CAPABILITY_SNAPSHOT_BUILDER_VERSION,
    snapshotType: PROJECT_CAPABILITY_SNAPSHOT_TYPE,
    generatedAt: normalizeString(input.generatedAt, new Date().toISOString()),

    sourceOfTruth: PROJECT_CAPABILITY_SOURCE_OF_TRUTH,
    advisoryOnly: PROJECT_CAPABILITY_ADVISORY_ONLY,
    notice: PROJECT_CAPABILITY_SNAPSHOT_NOTICE,

    project: {
      key: normalizeString(input.projectKey, PROJECT_CAPABILITY_DEFAULT_PROJECT.key),
      name: normalizeString(
        input.projectName,
        PROJECT_CAPABILITY_DEFAULT_PROJECT.name
      ),
      stageKey: normalizeString(
        input.stageKey,
        PROJECT_CAPABILITY_DEFAULT_PROJECT.stageKey
      ),
    },

    evidence: {
      repoRef: normalizeString(input.repoRef, PROJECT_CAPABILITY_DEFAULT_REPO_REF),
      verifiedFiles: normalizeStringArray(input.verifiedFiles),
      verifiedCommands: normalizeStringArray(input.verifiedCommands),
      verifiedCommits: normalizeStringArray(input.verifiedCommits),
      facts,
      runtime,
      tests,
    },

    capabilities: capabilities.map((capability) => ({
      key: normalizeString(capability?.key, "unknown"),
      title: normalizeString(capability?.title, "Unknown capability"),
      status: normalizeString(
        capability?.status,
        PROJECT_CAPABILITY_STATUS.UNKNOWN
      ),
      userBenefit: normalizeString(capability?.userBenefit),
      evidenceRefs: normalizeStringArray(capability?.evidenceRefs),
      limitations: normalizeStringArray(capability?.limitations),
    })),

    limitations: normalizeStringArray(input.limitations),
    nextSafeStep: normalizeString(input.nextSafeStep),
  };
}

export default {
  PROJECT_CAPABILITY_SNAPSHOT_BUILDER_VERSION,
  buildProjectCapabilitySnapshot,
};
