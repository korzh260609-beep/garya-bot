// scripts/smokeProjectMemoryUserProjectGuard.js
// SG 2.0 — Project Memory user project guard integration smoke.
//
// This smoke must not touch real PostgreSQL, AI, Telegram, Render, GitHub, or runtime files.

import assert from "node:assert/strict";
import {
  PROJECT_MEMORY_CONFIRMATION_DECISIONS,
  PROJECT_MEMORY_RUNTIME_CONTEXT_MODES,
  PROJECT_MEMORY_SOURCE_TYPES,
  PROJECT_MEMORY_TRUST,
  PROJECT_MEMORY_TYPES,
  ProjectMemoryConfirmation,
  ProjectMemoryRuntimeContext,
  ProjectMemoryStore,
} from "../src/memory/index.js";

function createMemoryQueryFn() {
  const entries = new Map();
  const audit = new Map();

  async function queryFn(sql, params = []) {
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
      audit.set(traceId, {
        trace_id: traceId,
        action,
        entry_id: entryId,
        decision,
        reason,
        actor_ref: actorRef,
        metadata: metadataJson,
      });
      return { ok: true, rowCount: 1, rows: [] };
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

  return { queryFn, entries, audit };
}

function createMockUserProjectValidator() {
  return {
    candidateCalls: [],
    readCalls: [],
    async validateUserProjectCandidateWrite({ actor = {}, projectKey = "" } = {}) {
      this.candidateCalls.push({ actor, projectKey });
      if (projectKey === "user_project:global-user-1:alpha-client" && actor.globalUserId === "global-user-1") {
        return { ok: true, allowed: true, reason: null, project: { id: "alpha-client", status: "active" } };
      }
      return { ok: false, allowed: false, reason: "mock_user_project_guard_denied" };
    },
    async validateUserProjectRead({ actor = {}, projectKey = "" } = {}) {
      this.readCalls.push({ actor, projectKey });
      if (projectKey === "user_project:global-user-1:alpha-client" && actor.globalUserId === "global-user-1") {
        return { ok: true, allowed: true, reason: null, project: { id: "alpha-client", status: "active" } };
      }
      return { ok: false, allowed: false, reason: "mock_user_project_read_denied" };
    },
  };
}

const memoryDb = createMemoryQueryFn();
const store = new ProjectMemoryStore({ queryFn: memoryDb.queryFn });
const userProjectValidator = createMockUserProjectValidator();
const logger = { log() {}, warn() {}, error() {} };

const confirmation = new ProjectMemoryConfirmation({
  store,
  userProjectValidator,
  logger,
});

const confirmationStatus = confirmation.status();
assert.equal(confirmationStatus.hasUserProjectValidationGuard, true);

const confirmationDiagnostics = confirmation.getDiagnostics();
assert.equal(confirmationDiagnostics.boundaries.usesUserProjectValidationGuard, true);
assert.equal(confirmationDiagnostics.sideEffects.validatesUserProjectBeforeUserProjectCandidateWrite, true);
assert.equal(confirmationDiagnostics.sideEffects.autoWritesFromChat, false);
assert.equal(confirmationDiagnostics.sideEffects.callsAI, false);
assert.equal(confirmationDiagnostics.sideEffects.touchesTelegram, false);

const sgCandidate = await confirmation.prepareCandidateForConfirmation({
  input: {
    type: PROJECT_MEMORY_TYPES.WORKFLOW_RULE,
    title: "SG memory candidate skips user project guard",
    content: "SG Project Memory uses project_key sg and does not require User Projects Registry validation.",
    sourceType: PROJECT_MEMORY_SOURCE_TYPES.MONARCH_APPROVAL,
    sourceRef: "smoke:sg-candidate",
  },
  createdBy: "monarch:test",
  projectKey: "sg",
  traceId: "smoke-sg-candidate",
});
assert.equal(sgCandidate.ok, true);
assert.equal(sgCandidate.stored, true);
assert.equal(sgCandidate.guard.ok, true);
assert.equal(sgCandidate.guard.skipped, true);
assert.equal(userProjectValidator.candidateCalls.length, 0);

const deniedUserProjectCandidate = await confirmation.prepareCandidateForConfirmation({
  input: {
    type: PROJECT_MEMORY_TYPES.WORKFLOW_RULE,
    title: "Denied user project candidate",
    content: "This candidate must not be stored because the user project guard denies it.",
    sourceType: PROJECT_MEMORY_SOURCE_TYPES.MONARCH_APPROVAL,
    sourceRef: "smoke:denied-user-project-candidate",
  },
  createdBy: "user:test",
  projectKey: "user_project:global-user-1:alpha-client",
  actor: { globalUserId: "global-user-2" },
  traceId: "smoke-denied-user-project-candidate",
});
assert.equal(deniedUserProjectCandidate.ok, false);
assert.equal(deniedUserProjectCandidate.stored, false);
assert.equal(deniedUserProjectCandidate.decision, PROJECT_MEMORY_CONFIRMATION_DECISIONS.CANDIDATE_REJECTED);
assert.equal(deniedUserProjectCandidate.reason, "mock_user_project_guard_denied");
assert.equal(deniedUserProjectCandidate.guard.validation.reason, "mock_user_project_guard_denied");
assert.equal(memoryDb.entries.has("smoke-denied-user-project-candidate"), false);

const allowedUserProjectCandidate = await confirmation.prepareCandidateForConfirmation({
  input: {
    type: PROJECT_MEMORY_TYPES.WORKFLOW_RULE,
    title: "Allowed user project candidate",
    content: "This candidate can be stored because the user project guard allows it.",
    sourceType: PROJECT_MEMORY_SOURCE_TYPES.MONARCH_APPROVAL,
    sourceRef: "smoke:allowed-user-project-candidate",
  },
  createdBy: "user:test",
  projectKey: "user_project:global-user-1:alpha-client",
  actor: { globalUserId: "global-user-1" },
  traceId: "smoke-allowed-user-project-candidate",
});
assert.equal(allowedUserProjectCandidate.ok, true);
assert.equal(allowedUserProjectCandidate.stored, true);
assert.equal(allowedUserProjectCandidate.guard.ok, true);
assert.equal(allowedUserProjectCandidate.guard.skipped, false);
assert.equal(userProjectValidator.candidateCalls.length, 2);

const runtimeContext = new ProjectMemoryRuntimeContext({
  store,
  userProjectValidator,
  logger,
});

const runtimeStatus = runtimeContext.status();
assert.equal(runtimeStatus.hasUserProjectValidationGuard, true);
assert.equal(runtimeStatus.writesStorage, false);
assert.equal(runtimeStatus.confirmsCandidates, false);
assert.equal(runtimeStatus.callsAI, false);
assert.equal(runtimeStatus.injectsPrompt, false);

const runtimeDiagnostics = runtimeContext.getDiagnostics();
assert.equal(runtimeDiagnostics.boundaries.usesUserProjectValidationGuard, true);
assert.equal(runtimeDiagnostics.sideEffects.validatesUserProjectBeforeUserProjectRead, true);
assert.equal(runtimeDiagnostics.sideEffects.writesStorage, false);
assert.equal(runtimeDiagnostics.sideEffects.callsAI, false);
assert.equal(runtimeDiagnostics.sideEffects.touchesTelegram, false);
assert.equal(runtimeDiagnostics.sideEffects.injectsPrompt, false);

const sgFacts = await runtimeContext.loadConfirmedProjectMemoryFacts({
  projectKey: "sg",
  actor: { globalUserId: "global-user-2" },
});
assert.equal(sgFacts.ok, true);
assert.equal(sgFacts.guard.ok, true);
assert.equal(sgFacts.guard.skipped, true);
assert.equal(userProjectValidator.readCalls.length, 0);

const deniedUserProjectFacts = await runtimeContext.loadConfirmedProjectMemoryFacts({
  projectKey: "user_project:global-user-1:alpha-client",
  actor: { globalUserId: "global-user-2" },
});
assert.equal(deniedUserProjectFacts.ok, false);
assert.equal(deniedUserProjectFacts.mode, PROJECT_MEMORY_RUNTIME_CONTEXT_MODES.READ_CONFIRMED_ONLY);
assert.equal(deniedUserProjectFacts.reason, "mock_user_project_read_denied");
assert.deepEqual(deniedUserProjectFacts.facts, []);

const allowedUserProjectFacts = await runtimeContext.loadConfirmedProjectMemoryFacts({
  projectKey: "user_project:global-user-1:alpha-client",
  actor: { globalUserId: "global-user-1" },
});
assert.equal(allowedUserProjectFacts.ok, true);
assert.equal(allowedUserProjectFacts.guard.ok, true);
assert.equal(allowedUserProjectFacts.guard.skipped, false);
assert.equal(userProjectValidator.readCalls.length, 2);

const deniedContextItems = await runtimeContext.buildConfirmedProjectMemoryContextItems({
  projectKey: "user_project:global-user-1:alpha-client",
  actor: { globalUserId: "global-user-2" },
});
assert.equal(deniedContextItems.ok, false);
assert.equal(deniedContextItems.reason, "mock_user_project_read_denied");
assert.deepEqual(deniedContextItems.items, []);

console.log("OK smoke:project-memory-user-project-guard");
