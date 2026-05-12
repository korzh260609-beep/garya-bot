// scripts/smokeProjectMemoryRuntimeContext.js
// SG 2.0 — Project Memory runtime read context smoke.
// This smoke must stay deterministic, offline, and must not touch the real DB/network.

import assert from "node:assert/strict";
import {
  PROJECT_MEMORY_RUNTIME_CONTEXT_MODES,
  PROJECT_MEMORY_SOURCE_TYPES,
  PROJECT_MEMORY_TRUST,
  PROJECT_MEMORY_TYPES,
  ProjectMemoryRuntimeContext,
  ProjectMemoryStore,
  buildContextPack,
  formatContextPackForPrompt,
  getMemoryModuleStatus,
} from "../src/memory/index.js";

function createMemoryQueryFn() {
  const rows = [
    {
      id: "pm_confirmed_1",
      project_key: "sg",
      item_type: PROJECT_MEMORY_TYPES.ARCHITECTURE_DECISION,
      title: "Project Memory reads confirmed entries only",
      content: "Runtime context may read confirmed Project Memory entries as support context below verified sources.",
      scope: "global_project",
      trust: PROJECT_MEMORY_TRUST.CONFIRMED,
      status: "active",
      source_type: PROJECT_MEMORY_SOURCE_TYPES.MONARCH_APPROVAL,
      source_ref: "smoke:runtime-context",
      tags: JSON.stringify(["project_memory", "runtime_context"]),
      metadata: JSON.stringify({ smoke: true }),
      created_by: "monarch:test",
      created_at: "2026-05-12T00:00:00.000Z",
      updated_at: "2026-05-12T00:01:00.000Z",
      confirmed_by: "monarch:test",
      confirmed_at: "2026-05-12T00:01:00.000Z",
      supersedes_id: null,
      trace_id: "smoke-trace-confirmed-1",
    },
    {
      id: "pm_confirmed_2",
      project_key: "sg",
      item_type: PROJECT_MEMORY_TYPES.WORKFLOW_RULE,
      title: "No prompt injection in runtime context bridge",
      content: "ProjectMemoryRuntimeContext returns facts/items but does not inject them into AI prompts by itself.",
      scope: "workflow",
      trust: PROJECT_MEMORY_TRUST.CONFIRMED,
      status: "active",
      source_type: PROJECT_MEMORY_SOURCE_TYPES.PR,
      source_ref: "#192",
      tags: JSON.stringify(["context", "safety"]),
      metadata: JSON.stringify({ smoke: true, order: 2 }),
      created_by: "monarch:test",
      created_at: "2026-05-12T00:02:00.000Z",
      updated_at: "2026-05-12T00:03:00.000Z",
      confirmed_by: "monarch:test",
      confirmed_at: "2026-05-12T00:03:00.000Z",
      supersedes_id: null,
      trace_id: "smoke-trace-confirmed-2",
    },
  ];
  const calls = [];

  async function queryFn(sql, params = []) {
    calls.push({ sql, params });
    const normalizedSql = String(sql).replace(/\s+/g, " ").trim();

    if (normalizedSql.startsWith("CREATE TABLE") || normalizedSql.startsWith("CREATE INDEX")) {
      return { ok: true, rowCount: 0, rows: [] };
    }

    if (normalizedSql.startsWith("SELECT * FROM sg_project_memory_entries")) {
      const [projectKey, trust, status, limit] = params;
      const selected = rows
        .filter((row) => row.project_key === projectKey && row.trust === trust && row.status === status)
        .slice(0, limit);
      return { ok: true, rowCount: selected.length, rows: selected };
    }

    return { ok: false, reason: "unexpected_sql", sql: normalizedSql };
  }

  return { queryFn, calls };
}

const moduleStatus = getMemoryModuleStatus();
assert.equal(moduleStatus.ok, true);
assert.equal(moduleStatus.hasDb, false);
assert.equal(moduleStatus.hasStorageBoundary, true);
assert.equal(moduleStatus.hasDurableProjectMemoryConfirmationBoundary, true);
assert.equal(moduleStatus.hasProjectMemoryRuntimeReadBridge, true);
assert.equal(moduleStatus.hasTransportLogic, false);
assert.equal(moduleStatus.hasAICalls, false);
assert.equal(moduleStatus.hasSourceFetching, false);
assert.equal(moduleStatus.principles.projectMemoryRuntimeReadConfirmedOnly, true);
assert.equal(moduleStatus.principles.projectMemoryAutoWriteDisabled, true);

const memoryDb = createMemoryQueryFn();
const store = new ProjectMemoryStore({ queryFn: memoryDb.queryFn });
const runtimeContext = new ProjectMemoryRuntimeContext({
  store,
  logger: { log() {}, warn() {}, error() {} },
});

const status = runtimeContext.status();
assert.equal(status.ok, true);
assert.equal(status.mode, PROJECT_MEMORY_RUNTIME_CONTEXT_MODES.READ_CONFIRMED_ONLY);
assert.equal(status.readsConfirmedOnly, true);
assert.equal(status.writesStorage, false);
assert.equal(status.confirmsCandidates, false);
assert.equal(status.autoWriteFromChat, false);
assert.equal(status.autoWriteFromAI, false);
assert.equal(status.sourceSync, false);
assert.equal(status.telegramConnected, false);
assert.equal(status.callsAI, false);
assert.equal(status.injectsPrompt, false);

const diagnostics = runtimeContext.getDiagnostics();
assert.equal(diagnostics.ok, true);
assert.equal(diagnostics.boundaries.usesProjectMemoryStore, true);
assert.equal(diagnostics.boundaries.confirmedOnly, true);
assert.equal(diagnostics.boundaries.transportIndependent, true);
assert.equal(diagnostics.boundaries.aiIndependent, true);
assert.equal(diagnostics.boundaries.sourceSyncIndependent, true);
assert.equal(diagnostics.boundaries.promptInjectionIndependent, true);
assert.equal(diagnostics.sideEffects.readsStorage, true);
assert.equal(diagnostics.sideEffects.writesStorage, false);
assert.equal(diagnostics.sideEffects.confirmsCandidates, false);
assert.equal(diagnostics.sideEffects.autoWritesFromChat, false);
assert.equal(diagnostics.sideEffects.callsAI, false);
assert.equal(diagnostics.sideEffects.touchesTelegram, false);
assert.equal(diagnostics.sideEffects.fetchesSources, false);
assert.equal(diagnostics.sideEffects.injectsPrompt, false);
assert.ok(diagnostics.blockedActions.includes("create_candidate"));
assert.ok(diagnostics.blockedActions.includes("confirm_candidate"));
assert.ok(diagnostics.blockedActions.includes("prompt_injection"));

const loaded = await runtimeContext.loadConfirmedProjectMemoryFacts({
  projectKey: "sg",
  limits: { maxEntries: 1, maxContentChars: 80, maxTitleChars: 60 },
});
assert.equal(loaded.ok, true);
assert.equal(loaded.mode, PROJECT_MEMORY_RUNTIME_CONTEXT_MODES.READ_CONFIRMED_ONLY);
assert.equal(loaded.facts.length, 1);
assert.equal(loaded.facts[0].metadata.trust, PROJECT_MEMORY_TRUST.CONFIRMED);
assert.equal(loaded.facts[0].metadata.status, "active");
assert.equal(loaded.facts[0].metadata.projectMemoryId, "pm_confirmed_1");
assert.equal(loaded.facts[0].content.length <= 81, true);
assert.equal(loaded.limits.maxEntries, 1);

const contextItems = await runtimeContext.buildConfirmedProjectMemoryContextItems({
  projectKey: "sg",
  limits: { maxEntries: 2, maxContentChars: 300 },
});
assert.equal(contextItems.ok, true);
assert.equal(contextItems.items.length, 2);
for (const item of contextItems.items) {
  assert.equal(item.type, "project_memory");
  assert.equal(item.priority, "below_verified_sources");
  assert.equal(item.trust, PROJECT_MEMORY_TRUST.CONFIRMED);
  assert.equal(item.owner, "sg_project");
  assert.ok(item.metadata.projectMemoryId);
  assert.equal(item.metadata.runtimeContextBridgeVersion, 1);
}

const pack = buildContextPack({
  userId: "global:test",
  userMessage: "What is the current Project Memory rule?",
  projectMemory: contextItems.facts,
  repoFacts: [
    {
      content: "Repository facts outrank Project Memory context.",
      source: "smoke:repo_fact",
      metadata: { smoke: true },
    },
  ],
  limits: { maxItems: 10, maxChars: 500 },
});
assert.equal(pack.items.some((item) => item.type === "project_memory"), true);
assert.equal(pack.items.some((item) => item.type === "repo_fact"), true);

const formatted = formatContextPackForPrompt(pack, {
  limits: { maxItems: 10, maxTotalChars: 3000, maxItemChars: 500 },
});
assert.equal(formatted.ok, true);
assert.equal(formatted.text.includes("Verified sources and pillars outrank memory"), true);
assert.equal(formatted.text.includes("type=project_memory"), true);
assert.equal(formatted.text.includes("type=repo_fact"), true);
assert.equal(formatted.text.includes("What is the current Project Memory rule?"), false);

console.log("smokeProjectMemoryRuntimeContext: ok");
