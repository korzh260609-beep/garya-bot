// scripts/smokeProjectMemoryStorageConfirmation.js
// SG 2.0 — Project Memory storage confirmation smoke.
// This smoke must stay deterministic, offline, and must not touch the real DB/network.

import assert from "node:assert/strict";
import {
  PROJECT_MEMORY_CONFIRMATION_DECISIONS,
  PROJECT_MEMORY_CONFIRMATION_MODES,
  PROJECT_MEMORY_SOURCE_TYPES,
  PROJECT_MEMORY_TRUST,
  PROJECT_MEMORY_TYPES,
  ProjectMemoryConfirmation,
  ProjectMemoryStore,
  createProjectMemoryItem,
  getMemoryModuleStatus,
} from "../src/memory/index.js";

function createMemoryQueryFn() {
  const entries = new Map();
  const audit = new Map();
  const calls = [];

  async function queryFn(sql, params = []) {
    calls.push({ sql, params });
    const normalizedSql = String(sql).replace(/\s+/g, " ").trim();

    if (normalizedSql.startsWith("CREATE TABLE") || normalizedSql.startsWith("CREATE INDEX")) {
      return { ok: true, rowCount: 0, rows: [] };
    }

    if (normalizedSql.startsWith("INSERT INTO sg_project_memory_entries")) {
      const [
        id,
        projectKey,
        itemType,
        title,
        content,
        scope,
        sourceType,
        sourceRef,
        tagsJson,
        metadataJson,
        createdBy,
        traceId,
      ] = params;
      const row = {
        id,
        project_key: projectKey,
        item_type: itemType,
        title,
        content,
        scope,
        trust: PROJECT_MEMORY_TRUST.CANDIDATE,
        status: "pending_confirmation",
        source_type: sourceType,
        source_ref: sourceRef,
        tags: tagsJson,
        metadata: metadataJson,
        created_by: createdBy,
        created_at: "2026-05-12T00:00:00.000Z",
        updated_at: "2026-05-12T00:00:00.000Z",
        confirmed_by: null,
        confirmed_at: null,
        supersedes_id: null,
        trace_id: traceId,
      };
      entries.set(id, row);
      return { ok: true, rowCount: 1, rows: [row] };
    }

    if (normalizedSql.startsWith("INSERT INTO sg_project_memory_write_audit")) {
      const [traceId, action, entryId, decision, reason, actorRef, metadataJson] = params;
      if (!audit.has(traceId)) {
        audit.set(traceId, {
          trace_id: traceId,
          action,
          entry_id: entryId,
          decision,
          reason,
          actor_ref: actorRef,
          metadata: metadataJson,
        });
      }
      return { ok: true, rowCount: 1, rows: [] };
    }

    if (normalizedSql.startsWith("UPDATE sg_project_memory_entries")) {
      const [entryId, confirmedBy, traceId] = params;
      const row = entries.get(entryId);
      if (!row || row.trust !== PROJECT_MEMORY_TRUST.CANDIDATE || row.status !== "pending_confirmation") {
        return { ok: true, rowCount: 0, rows: [] };
      }
      const updated = {
        ...row,
        trust: PROJECT_MEMORY_TRUST.CONFIRMED,
        status: "active",
        confirmed_by: confirmedBy,
        confirmed_at: "2026-05-12T00:01:00.000Z",
        updated_at: "2026-05-12T00:01:00.000Z",
        trace_id: traceId,
      };
      entries.set(entryId, updated);
      return { ok: true, rowCount: 1, rows: [updated] };
    }

    if (normalizedSql.startsWith("SELECT * FROM sg_project_memory_entries")) {
      const [projectKey, trust, status, limit] = params;
      const rows = [...entries.values()]
        .filter((row) => row.project_key === projectKey && row.trust === trust && row.status === status)
        .slice(0, limit);
      return { ok: true, rowCount: rows.length, rows };
    }

    return { ok: false, reason: "unexpected_sql", sql: normalizedSql };
  }

  return { queryFn, entries, audit, calls };
}

const moduleStatus = getMemoryModuleStatus();
assert.equal(moduleStatus.ok, true);
assert.equal(moduleStatus.hasDb, true);
assert.equal(moduleStatus.hasTransportLogic, false);
assert.equal(moduleStatus.hasAICalls, false);
assert.equal(moduleStatus.hasSourceFetching, false);
assert.equal(moduleStatus.principles.durableProjectMemoryRequiresConfirmation, true);
assert.equal(moduleStatus.principles.projectMemoryAutoWriteDisabled, true);

const memoryDb = createMemoryQueryFn();
const store = new ProjectMemoryStore({ queryFn: memoryDb.queryFn });
const confirmation = new ProjectMemoryConfirmation({
  store,
  logger: { log() {}, warn() {}, error() {} },
});

const status = confirmation.status();
assert.equal(status.ok, true);
assert.equal(status.mode, PROJECT_MEMORY_CONFIRMATION_MODES.EXPLICIT_ONLY);
assert.equal(status.hasDbBoundary, true);
assert.equal(status.autoWriteFromChat, false);
assert.equal(status.autoWriteFromAI, false);
assert.equal(status.sourceSync, false);
assert.equal(status.telegramConnected, false);
assert.equal(status.callsAI, false);
assert.equal(status.requiresExplicitCaller, true);
assert.equal(status.requiresExternalApprovalDecision, true);

const diagnostics = confirmation.getDiagnostics();
assert.equal(diagnostics.ok, true);
assert.equal(diagnostics.boundaries.usesProjectMemoryServiceValidation, true);
assert.equal(diagnostics.boundaries.usesProjectMemoryStore, true);
assert.equal(diagnostics.boundaries.transportIndependent, true);
assert.equal(diagnostics.boundaries.aiIndependent, true);
assert.equal(diagnostics.sideEffects.autoWritesFromChat, false);
assert.equal(diagnostics.sideEffects.callsAI, false);
assert.equal(diagnostics.sideEffects.touchesTelegram, false);
assert.equal(diagnostics.sideEffects.fetchesSources, false);
assert.equal(diagnostics.sideEffects.modifiesRepository, false);
assert.ok(diagnostics.blockedActions.includes("auto_write_from_chat"));
assert.ok(diagnostics.blockedActions.includes("ai_auto_write"));
assert.ok(diagnostics.blockedActions.includes("source_sync"));

const rejected = await confirmation.prepareCandidateForConfirmation({
  input: {
    title: "Secret raw data must be rejected",
    content: "DATABASE_URL=postgres://user:pass@example/db",
    sourceType: PROJECT_MEMORY_SOURCE_TYPES.MONARCH_APPROVAL,
  },
  createdBy: "monarch:test",
});
assert.equal(rejected.ok, false);
assert.equal(rejected.decision, PROJECT_MEMORY_CONFIRMATION_DECISIONS.CANDIDATE_REJECTED);
assert.equal(rejected.stored, false);
assert.equal(memoryDb.entries.size, 0);

const prepared = await confirmation.prepareCandidateForConfirmation({
  input: {
    type: PROJECT_MEMORY_TYPES.ARCHITECTURE_DECISION,
    title: "Project Memory confirmation requires explicit approval",
    content: "Durable Project Memory entries are stored first as candidates and become confirmed only after explicit confirmation.",
    sourceType: PROJECT_MEMORY_SOURCE_TYPES.MONARCH_APPROVAL,
    sourceRef: "smoke:project-memory-storage-confirmation",
    tags: ["project_memory", "confirmation"],
  },
  createdBy: "monarch:test",
  projectKey: "sg",
  traceId: "smoke-trace-create",
});
assert.equal(prepared.ok, true);
assert.equal(prepared.mode, PROJECT_MEMORY_CONFIRMATION_MODES.EXPLICIT_ONLY);
assert.equal(prepared.decision, PROJECT_MEMORY_CONFIRMATION_DECISIONS.CANDIDATE_CREATED);
assert.equal(prepared.stored, true);
assert.equal(prepared.requiresConfirmation, true);
assert.equal(prepared.entry.trust, PROJECT_MEMORY_TRUST.CANDIDATE);
assert.equal(prepared.entry.status, "pending_confirmation");
assert.equal(memoryDb.entries.size, 1);
assert.equal(memoryDb.audit.has("smoke-trace-create"), true);

const missingEntryId = await confirmation.confirmCandidate({
  entryId: "",
  confirmedBy: "monarch:test",
});
assert.equal(missingEntryId.ok, false);
assert.equal(missingEntryId.reason, "missing_entry_id");
assert.equal(missingEntryId.decision, PROJECT_MEMORY_CONFIRMATION_DECISIONS.NOT_CONFIRMED);

const confirmed = await confirmation.confirmCandidate({
  entryId: prepared.entry.id,
  confirmedBy: "monarch:test",
  traceId: "smoke-trace-confirm",
  approvalRef: "smoke:approved",
});
assert.equal(confirmed.ok, true);
assert.equal(confirmed.decision, PROJECT_MEMORY_CONFIRMATION_DECISIONS.CONFIRMED);
assert.equal(confirmed.entry.trust, PROJECT_MEMORY_TRUST.CONFIRMED);
assert.equal(confirmed.entry.status, "active");
assert.equal(confirmed.entry.confirmedBy, "monarch:test");
assert.equal(confirmed.approvalRef, "smoke:approved");

const doubleConfirm = await confirmation.confirmCandidate({
  entryId: prepared.entry.id,
  confirmedBy: "monarch:test",
  traceId: "smoke-trace-double-confirm",
});
assert.equal(doubleConfirm.ok, false);
assert.equal(doubleConfirm.reason, "candidate_not_found_or_not_pending");
assert.equal(doubleConfirm.decision, PROJECT_MEMORY_CONFIRMATION_DECISIONS.NOT_CONFIRMED);

const listed = await confirmation.listConfirmedEntries({ projectKey: "sg", limit: 10 });
assert.equal(listed.ok, true);
assert.equal(listed.entries.length, 1);
assert.equal(listed.entries[0].trust, PROJECT_MEMORY_TRUST.CONFIRMED);
assert.equal(listed.entries[0].title, "Project Memory confirmation requires explicit approval");

const directStoreCandidate = await store.createCandidate({
  item: createProjectMemoryItem({
    type: PROJECT_MEMORY_TYPES.WORKFLOW_RULE,
    title: "Store creates pending candidate",
    content: "ProjectMemoryStore.createCandidate writes pending_confirmation candidate entries only.",
    sourceType: PROJECT_MEMORY_SOURCE_TYPES.MONARCH_APPROVAL,
    sourceRef: "smoke:store",
  }),
  createdBy: "smoke:test",
  projectKey: "sg",
  traceId: "smoke-trace-store-direct",
});
assert.equal(directStoreCandidate.ok, true);
assert.equal(directStoreCandidate.entry.trust, PROJECT_MEMORY_TRUST.CANDIDATE);
assert.equal(directStoreCandidate.entry.status, "pending_confirmation");

console.log("smokeProjectMemoryStorageConfirmation: ok");
