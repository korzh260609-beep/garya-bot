// scripts/smokeProjectMemoryConfirmedReadFlow.js
// SG 2.0 — Confirmed Project Memory read flow smoke.
// This smoke must stay deterministic, offline, and must not touch real DB/network/AI/Telegram/runtime files.

import assert from "node:assert/strict";
import {
  PROJECT_MEMORY_CONFIRMED_READ_FLOW_DECISIONS,
  PROJECT_MEMORY_CONFIRMED_READ_FLOW_MODES,
  PROJECT_MEMORY_TRUST,
  buildProjectMemoryConfirmedReadFlowStatus,
  getMemoryModuleStatus,
  getProjectMemoryConfirmedReadFlowBoundaries,
  readConfirmedProjectMemoryContext,
} from "../src/memory/index.js";

function createRuntimeContextRecorder({ ok = true } = {}) {
  const calls = [];

  return {
    calls,
    async buildConfirmedProjectMemoryContextItems(input = {}) {
      calls.push(input);

      if (!ok) {
        return {
          ok: false,
          reason: "mock_confirmed_read_failed",
          facts: [],
          items: [],
          warnings: [{ code: "mock_warning", message: "Mock warning." }],
        };
      }

      return {
        ok: true,
        mode: "read_confirmed_only",
        facts: [
          {
            content: "Confirmed memory fact content.",
            source: "smoke:confirmed-memory",
            metadata: {
              projectMemoryId: "pm_confirmed_1",
              projectKey: input.projectKey,
              trust: PROJECT_MEMORY_TRUST.CONFIRMED,
              status: "active",
            },
          },
        ],
        items: [
          {
            type: "project_memory",
            content: "Confirmed memory fact content.",
            source: "smoke:confirmed-memory",
            priority: "below_verified_sources",
            trust: PROJECT_MEMORY_TRUST.CONFIRMED,
            scope: "global_project",
            owner: "sg_project",
            metadata: {
              projectMemoryId: "pm_confirmed_1",
              projectKey: input.projectKey,
              trust: PROJECT_MEMORY_TRUST.CONFIRMED,
              status: "active",
            },
          },
        ],
        warnings: [],
        limits: input.limits || {},
        guard: { ok: true, skipped: true, reason: "not_user_project_memory" },
      };
    },
  };
}

const moduleStatus = getMemoryModuleStatus();
assert.equal(moduleStatus.ok, true);
assert.equal(moduleStatus.hasProjectMemoryConfirmedReadFlow, true);
assert.equal(moduleStatus.hasProjectMemoryExplicitConfirmationFlow, true);
assert.equal(moduleStatus.hasProjectMemoryManualCandidateFlow, true);
assert.equal(moduleStatus.hasTransportLogic, false);
assert.equal(moduleStatus.hasAICalls, false);
assert.equal(moduleStatus.principles.projectMemoryAutoWriteDisabled, true);
assert.equal(moduleStatus.principles.projectMemoryConfirmedReadOnly, true);
assert.equal(moduleStatus.principles.projectMemoryRuntimeReadConfirmedOnly, true);

const status = buildProjectMemoryConfirmedReadFlowStatus();
assert.equal(status.ok, true);
assert.equal(status.mode, PROJECT_MEMORY_CONFIRMED_READ_FLOW_MODES.EXPLICIT_READ_CONFIRMED_ONLY);
assert.equal(status.canReadConfirmedContext, true);
assert.equal(status.canCreateCandidate, false);
assert.equal(status.canConfirmCandidate, false);
assert.equal(status.writesStorage, false);
assert.equal(status.autoReadFromChat, false);
assert.equal(status.autoWriteFromChat, false);
assert.equal(status.promptInjection, false);
assert.equal(status.callsAI, false);
assert.equal(status.transportConnected, false);
assert.equal(status.requiresExplicitReadRequest, true);

const boundaries = getProjectMemoryConfirmedReadFlowBoundaries();
assert.equal(boundaries.transportIndependent, true);
assert.equal(boundaries.explicitReadRequestOnly, true);
assert.equal(boundaries.readsConfirmedOnly, true);
assert.equal(boundaries.createsCandidates, false);
assert.equal(boundaries.confirmsCandidates, false);
assert.equal(boundaries.writesStorage, false);
assert.equal(boundaries.infersFromNaturalLanguage, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.injectsPromptContext, false);
assert.equal(boundaries.autoReadsFromChat, false);
assert.equal(boundaries.autoWritesFromChat, false);

const missingExplicit = await readConfirmedProjectMemoryContext({
  request: {
    projectKey: "sg",
  },
  actor: { globalUserId: "global:monarch", role: "monarch", isMonarch: true },
  runtimeContext: createRuntimeContextRecorder(),
});
assert.equal(missingExplicit.ok, false);
assert.equal(missingExplicit.reason, "missing_explicit_read_request");
assert.equal(missingExplicit.promptInjectionEnabled, false);
assert.equal(missingExplicit.facts.length, 0);
assert.equal(missingExplicit.items.length, 0);

const runtimeContext = createRuntimeContextRecorder();
const read = await readConfirmedProjectMemoryContext({
  request: {
    explicitReadRequest: true,
    projectKey: "sg",
    limits: {
      maxEntries: 5,
      maxContentChars: 500,
      maxTitleChars: 120,
    },
  },
  actor: {
    globalUserId: "global:monarch",
    platform: "test",
    platformUserId: "260609",
    role: "monarch",
    isMonarch: true,
  },
  runtimeContext,
});

assert.equal(read.ok, true);
assert.equal(read.mode, PROJECT_MEMORY_CONFIRMED_READ_FLOW_MODES.EXPLICIT_READ_CONFIRMED_ONLY);
assert.equal(read.decision, PROJECT_MEMORY_CONFIRMED_READ_FLOW_DECISIONS.CONTEXT_BUILT);
assert.equal(read.promptInjectionEnabled, false);
assert.equal(read.projectKey, "sg");
assert.equal(read.facts.length, 1);
assert.equal(read.items.length, 1);
assert.equal(read.facts[0].metadata.trust, PROJECT_MEMORY_TRUST.CONFIRMED);
assert.equal(read.items[0].trust, PROJECT_MEMORY_TRUST.CONFIRMED);
assert.equal(runtimeContext.calls.length, 1);
assert.equal(runtimeContext.calls[0].projectKey, "sg");
assert.equal(runtimeContext.calls[0].actor.globalUserId, "global:monarch");
assert.equal(runtimeContext.calls[0].limits.maxEntries, 5);

const failingRuntimeContext = createRuntimeContextRecorder({ ok: false });
const failedRead = await readConfirmedProjectMemoryContext({
  request: {
    explicitReadRequest: true,
    projectKey: "sg",
  },
  actor: { globalUserId: "global:monarch", role: "monarch", isMonarch: true },
  runtimeContext: failingRuntimeContext,
});
assert.equal(failedRead.ok, false);
assert.equal(failedRead.decision, PROJECT_MEMORY_CONFIRMED_READ_FLOW_DECISIONS.REQUEST_REJECTED);
assert.equal(failedRead.reason, "mock_confirmed_read_failed");
assert.equal(failedRead.promptInjectionEnabled, false);
assert.equal(failedRead.facts.length, 0);
assert.equal(failedRead.items.length, 0);
assert.equal(failedRead.warnings.length, 1);

console.log("smokeProjectMemoryConfirmedReadFlow: ok");
