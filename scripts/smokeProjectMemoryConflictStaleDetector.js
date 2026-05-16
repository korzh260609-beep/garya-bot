// scripts/smokeProjectMemoryConflictStaleDetector.js
// SG 2.0 — Project Memory Conflict/Stale Detector smoke.
// Deterministic/offline: no DB, no GitHub, no Render, no Telegram, no AI.

import assert from "node:assert/strict";

import {
  buildProjectMemoryConflictStaleDetectorStatus,
  detectProjectMemoryConflictsAndStaleness,
  getProjectMemoryConflictStaleDetectorBoundaries,
  PROJECT_MEMORY_CONFLICT_STALE_LABELS,
} from "../src/memory/index.js";

const status = buildProjectMemoryConflictStaleDetectorStatus();
assert.equal(status.ok, true);
assert.equal(status.canDetectStaleEntries, true);
assert.equal(status.canDetectConflictedEntries, true);
assert.equal(status.canDetectDuplicateEntries, true);
assert.equal(status.canDetectSupersededEntries, true);
assert.equal(status.canDetectArchivedEntries, true);
assert.equal(status.canUseProvidedVerifiedEvidence, true);
assert.equal(status.canFetchEvidence, false);
assert.equal(status.canWriteStorage, false);
assert.equal(status.canConfirmCandidate, false);
assert.equal(status.callsAI, false);

const boundaries = getProjectMemoryConflictStaleDetectorBoundaries();
assert.equal(boundaries.transportIndependent, true);
assert.equal(boundaries.providedEntriesOnly, true);
assert.equal(boundaries.providedEvidenceOnly, true);
assert.equal(boundaries.readsStorage, false);
assert.equal(boundaries.writesStorage, false);
assert.equal(boundaries.createsCandidates, false);
assert.equal(boundaries.confirmsCandidates, false);
assert.equal(boundaries.writesConfirmedMemory, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.fetchesGitHub, false);
assert.equal(boundaries.fetchesRender, false);
assert.equal(boundaries.fetchesSources, false);
assert.equal(boundaries.sourceSync, false);
assert.equal(boundaries.touchesTelegram, false);
assert.equal(boundaries.readsRawChat, false);
assert.equal(boundaries.autoWritesFromChat, false);
assert.equal(boundaries.autoWritesFromAI, false);
assert.equal(boundaries.promptInjection, false);
assert.equal(boundaries.modifiesRepository, false);
assert.equal(boundaries.writesRuntimeFiles, false);
assert.equal(boundaries.changesEnvironment, false);

const invalid = detectProjectMemoryConflictsAndStaleness({ entries: "not-array" });
assert.equal(invalid.ok, false);
assert.equal(invalid.reason, "invalid_entries_input");
assert.equal(invalid.summary.entriesChecked, 0);
assert.equal(invalid.labels.length, 0);

const clean = detectProjectMemoryConflictsAndStaleness({
  entries: [
    {
      id: "pm_clean",
      projectKey: "sg",
      type: "decision",
      title: "Clean decision",
      sourceRef: "https://example.test/clean",
      status: "active",
      metadata: {},
    },
  ],
});
assert.equal(clean.ok, true);
assert.equal(clean.summary.entriesChecked, 1);
assert.equal(clean.labels.length, 0);
assert.equal(clean.summary.staleCount, 0);
assert.equal(clean.summary.conflictCount, 0);
assert.equal(clean.summary.duplicateGroupCount, 0);
assert.equal(clean.summary.supersededCount, 0);
assert.equal(clean.summary.archivedCount, 0);
assert.equal(clean.summary.contradictionCount, 0);

const detected = detectProjectMemoryConflictsAndStaleness({
  entries: [
    {
      id: "pm_stale",
      projectKey: "sg",
      type: "implementation_status",
      title: "Old status",
      sourceRef: "https://example.test/stale",
      status: "active",
      metadata: { stale: true, staleReason: "Replaced by newer repo state." },
    },
    {
      id: "pm_conflicted",
      projectKey: "sg",
      type: "decision",
      title: "Conflicted decision",
      sourceRef: "https://example.test/conflict",
      status: "active",
      metadata: {
        conflictsWithVerifiedSource: true,
        conflictReason: "Pillar says the opposite.",
      },
    },
    {
      id: "pm_dup_a",
      projectKey: "sg",
      type: "decision",
      title: "Duplicate Decision",
      sourceRef: "https://example.test/duplicate",
      status: "active",
      metadata: {},
    },
    {
      id: "pm_dup_b",
      projectKey: "sg",
      type: "decision",
      title: " duplicate decision ",
      sourceRef: "https://example.test/duplicate",
      status: "active",
      metadata: {},
    },
    {
      id: "pm_superseded",
      projectKey: "sg",
      type: "rollback_point",
      title: "Old rollback point",
      sourceRef: "https://example.test/superseded",
      status: "superseded",
      supersedesId: "pm_previous",
      metadata: { supersededBy: "pm_newer" },
    },
    {
      id: "pm_archived",
      projectKey: "sg",
      type: "implementation_status",
      title: "Archived status",
      sourceRef: "https://example.test/archived",
      status: "archived",
      metadata: {},
    },
    {
      id: "pm_contradicted",
      projectKey: "sg",
      type: "principle",
      title: "Contradicted principle",
      sourceRef: "https://example.test/contradicted",
      status: "active",
      metadata: {},
    },
  ],
  verifiedEvidence: [
    {
      kind: "contradiction",
      entryId: "pm_contradicted",
      sourceType: "repository",
      sourceRef: "https://github.com/korzh260609-beep/garya-bot/commit/example",
      reason: "Verified repository state contradicts this entry.",
    },
  ],
});

assert.equal(detected.ok, true);
assert.equal(detected.summary.entriesChecked, 7);
assert.equal(detected.summary.staleCount, 1);
assert.equal(detected.summary.conflictCount, 1);
assert.equal(detected.summary.duplicateGroupCount, 1);
assert.equal(detected.summary.supersededCount, 1);
assert.equal(detected.summary.archivedCount, 1);
assert.equal(detected.summary.contradictionCount, 1);

const labelById = new Map(detected.labels.map((item) => [item.entryId, item]));
assert.equal(labelById.get("pm_stale").labels.includes(PROJECT_MEMORY_CONFLICT_STALE_LABELS.STALE), true);
assert.equal(labelById.get("pm_conflicted").labels.includes(PROJECT_MEMORY_CONFLICT_STALE_LABELS.CONFLICTED), true);
assert.equal(labelById.get("pm_dup_a").labels.includes(PROJECT_MEMORY_CONFLICT_STALE_LABELS.DUPLICATE), true);
assert.equal(labelById.get("pm_dup_b").labels.includes(PROJECT_MEMORY_CONFLICT_STALE_LABELS.DUPLICATE), true);
assert.equal(labelById.get("pm_superseded").labels.includes(PROJECT_MEMORY_CONFLICT_STALE_LABELS.SUPERSEDED), true);
assert.equal(labelById.get("pm_archived").labels.includes(PROJECT_MEMORY_CONFLICT_STALE_LABELS.ARCHIVED), true);
assert.equal(
  labelById.get("pm_contradicted").labels.includes(
    PROJECT_MEMORY_CONFLICT_STALE_LABELS.CONTRADICTED_BY_VERIFIED_EVIDENCE,
  ),
  true,
);
assert.equal(labelById.get("pm_contradicted").evidence.length, 1);
assert.equal(labelById.get("pm_contradicted").evidence[0].sourceType, "repository");

assert.equal(detected.boundaries.readsStorage, false);
assert.equal(detected.boundaries.writesStorage, false);
assert.equal(detected.boundaries.callsAI, false);
assert.equal(detected.boundaries.touchesTelegram, false);
assert.equal(detected.boundaries.fetchesGitHub, false);
assert.equal(detected.boundaries.fetchesRender, false);
assert.equal(detected.boundaries.fetchesSources, false);
assert.equal(detected.boundaries.sourceSync, false);
assert.equal(detected.boundaries.modifiesRepository, false);
assert.equal(detected.boundaries.writesRuntimeFiles, false);
assert.equal(detected.boundaries.changesEnvironment, false);
assert.equal(detected.boundaries.writesConfirmedMemory, false);

console.log("smokeProjectMemoryConflictStaleDetector: ok");
