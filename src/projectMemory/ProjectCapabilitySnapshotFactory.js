// src/projectMemory/ProjectCapabilitySnapshotFactory.js
// ============================================================================
// PROJECT CAPABILITY SNAPSHOT FACTORY
// Stage: 7A.13 Project Capability Snapshot
//
// Purpose:
// - build and validate generated capability/status snapshots in one read-only step
// - keep future callers away from raw builder output unless validation passes
// - provide a safe boundary before any Telegram command or ProjectMemoryService write exists
//
// Important:
// - This file has no DB writes.
// - This file has no Telegram command wiring.
// - This file has no runtime side effects.
// - Caller must supply verified repo/runtime/test facts.
// ============================================================================

import { buildProjectCapabilitySnapshot } from "./ProjectCapabilitySnapshotBuilder.js";
import { validateProjectCapabilitySnapshot } from "./ProjectCapabilitySnapshotValidator.js";

export const PROJECT_CAPABILITY_SNAPSHOT_FACTORY_VERSION =
  "project-capability-snapshot-factory-7A13-2026-04-26-01";

export function createProjectCapabilitySnapshot(input = {}) {
  const snapshot = buildProjectCapabilitySnapshot(input);
  const validation = validateProjectCapabilitySnapshot(snapshot);

  return {
    ok: validation.ok,
    snapshot,
    validation,
    factoryVersion: PROJECT_CAPABILITY_SNAPSHOT_FACTORY_VERSION,
  };
}

export default {
  PROJECT_CAPABILITY_SNAPSHOT_FACTORY_VERSION,
  createProjectCapabilitySnapshot,
};
