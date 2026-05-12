// scripts/smokeUserProjectsRegistry.js
// SG 2.0 — User Projects Registry smoke.
//
// This smoke must not touch real PostgreSQL, AI, Telegram, Render, GitHub, or runtime files.

import assert from "node:assert/strict";
import {
  USER_PROJECTS_SCHEMA_VERSION,
  getUserProjectsSchemaSql,
  createUserProjectRecord,
  validateUserProjectRecord,
  normalizeUserProjectKeyPart,
  getProjectsModuleStatus,
  UserProjectsStore,
} from "../src/projects/index.js";

function createInMemoryUserProjectsQueryFn() {
  const projects = new Map();
  const calls = [];

  function rowFromProject(project) {
    return {
      id: project.id,
      owner_global_user_id: project.owner_global_user_id,
      title: project.title,
      slug: project.slug,
      status: project.status,
      visibility: project.visibility,
      metadata: project.metadata,
      created_at: project.created_at,
      updated_at: project.updated_at,
    };
  }

  return async function queryFn(sql = "", params = []) {
    calls.push({ sql, params });

    if (sql.includes("CREATE TABLE") || sql.includes("CREATE UNIQUE INDEX") || sql.includes("CREATE INDEX")) {
      return { ok: true, rows: [], rowCount: 0, calls };
    }

    if (sql.includes("INSERT INTO sg_user_projects")) {
      const [id, owner, title, slug, status, visibility, metadataJson] = params;
      const key = `${owner}:${id}`;
      const now = "2026-01-01T00:00:00.000Z";
      const existing = projects.get(key);
      const project = {
        id,
        owner_global_user_id: owner,
        title,
        slug,
        status,
        visibility,
        metadata: JSON.parse(metadataJson || "{}"),
        created_at: existing?.created_at || now,
        updated_at: now,
      };
      projects.set(key, project);
      return { ok: true, rows: [rowFromProject(project)], rowCount: 1, calls };
    }

    if (sql.includes("WHERE owner_global_user_id = $1 AND id = $2")) {
      const [owner, id] = params;
      const project = projects.get(`${owner}:${id}`);
      return { ok: true, rows: project ? [rowFromProject(project)] : [], rowCount: project ? 1 : 0, calls };
    }

    if (sql.includes("WHERE owner_global_user_id = $1 AND status = $2")) {
      const [owner, status, limit] = params;
      const rows = Array.from(projects.values())
        .filter((project) => project.owner_global_user_id === owner && project.status === status)
        .slice(0, limit)
        .map(rowFromProject);
      return { ok: true, rows, rowCount: rows.length, calls };
    }

    if (sql.includes("WHERE owner_global_user_id = $1")) {
      const [owner, limit] = params;
      const rows = Array.from(projects.values())
        .filter((project) => project.owner_global_user_id === owner)
        .slice(0, limit)
        .map(rowFromProject);
      return { ok: true, rows, rowCount: rows.length, calls };
    }

    return {
      ok: false,
      reason: "unexpected_sql_in_smoke",
      sql,
      params,
      calls,
    };
  };
}

assert.equal(USER_PROJECTS_SCHEMA_VERSION, 1);

const sql = getUserProjectsSchemaSql();
assert.ok(Array.isArray(sql));
assert.ok(sql.length >= 3);
assert.ok(sql.some((item) => item.includes("CREATE TABLE IF NOT EXISTS sg_user_projects")));
assert.ok(sql.some((item) => item.includes("PRIMARY KEY (owner_global_user_id, id)")));

assert.equal(normalizeUserProjectKeyPart("global:user-1"), "global-user-1");
assert.equal(normalizeUserProjectKeyPart(" Alpha Client! "), "alpha-client");

const record = createUserProjectRecord({
  id: "Alpha Client",
  ownerGlobalUserId: "global:user-1",
  title: "Alpha Client",
  slug: "Alpha Client",
  metadata: { source: "smoke" },
});

assert.equal(record.id, "alpha-client");
assert.equal(record.ownerGlobalUserId, "global-user-1");
assert.equal(record.slug, "alpha-client");
assert.equal(record.status, "active");
assert.equal(record.visibility, "private");
assert.equal(validateUserProjectRecord(record).ok, true);

const invalidRecord = createUserProjectRecord({ title: "No owner" });
assert.equal(validateUserProjectRecord(invalidRecord).ok, false);

const moduleStatus = getProjectsModuleStatus();
assert.equal(moduleStatus.ok, true);
assert.equal(moduleStatus.hasProjectMemoryWrites, false);
assert.equal(moduleStatus.hasProjectMemoryConfirmation, false);
assert.equal(moduleStatus.hasTransportLogic, false);
assert.equal(moduleStatus.hasAICalls, false);
assert.equal(moduleStatus.hasSourceFetching, false);

const queryFn = createInMemoryUserProjectsQueryFn();
const store = new UserProjectsStore({ queryFn });

const diagnostics = store.getDiagnostics();
assert.equal(diagnostics.ok, true);
assert.equal(diagnostics.boundaries.writesProjectMemory, false);
assert.equal(diagnostics.boundaries.confirmsProjectMemory, false);
assert.equal(diagnostics.boundaries.callsAI, false);
assert.equal(diagnostics.boundaries.touchesTelegram, false);
assert.equal(diagnostics.boundaries.fetchesSources, false);
assert.equal(diagnostics.boundaries.infersOwnershipFromText, false);

const ready = await store.ensureReady();
assert.equal(ready.ok, true);

const alpha = await store.createProject({
  ownerGlobalUserId: "global:user-1",
  id: "alpha-client",
  title: "Alpha Client",
  metadata: { kind: "client" },
});
assert.equal(alpha.ok, true);
assert.equal(alpha.project.ownerGlobalUserId, "global-user-1");
assert.equal(alpha.project.id, "alpha-client");
assert.equal(alpha.project.projectMemoryKey, "user_project:global-user-1:alpha-client");

const beta = await store.createProject({
  ownerGlobalUserId: "global:user-1",
  id: "beta-shop",
  title: "Beta Shop",
});
assert.equal(beta.ok, true);
assert.equal(beta.project.projectMemoryKey, "user_project:global-user-1:beta-shop");

const otherOwnerAlpha = await store.createProject({
  ownerGlobalUserId: "global:user-2",
  id: "alpha-client",
  title: "Alpha Client",
});
assert.equal(otherOwnerAlpha.ok, true);
assert.equal(otherOwnerAlpha.project.projectMemoryKey, "user_project:global-user-2:alpha-client");

const loadedAlpha = await store.getProject({
  ownerGlobalUserId: "global:user-1",
  id: "alpha-client",
});
assert.equal(loadedAlpha.ok, true);
assert.equal(loadedAlpha.project.title, "Alpha Client");

const userOneProjects = await store.listOwnerProjects({ ownerGlobalUserId: "global:user-1" });
assert.equal(userOneProjects.ok, true);
assert.equal(userOneProjects.projects.length, 2);
assert.deepEqual(
  userOneProjects.projects.map((project) => project.id).sort(),
  ["alpha-client", "beta-shop"],
);

const userTwoProjects = await store.listOwnerProjects({ ownerGlobalUserId: "global:user-2" });
assert.equal(userTwoProjects.ok, true);
assert.equal(userTwoProjects.projects.length, 1);
assert.equal(userTwoProjects.projects[0].id, "alpha-client");
assert.equal(userTwoProjects.projects[0].projectMemoryKey, "user_project:global-user-2:alpha-client");

const missingProject = await store.getProject({
  ownerGlobalUserId: "global:user-1",
  id: "missing",
});
assert.equal(missingProject.ok, false);
assert.equal(missingProject.reason, "user_project_not_found");

const badCreate = await store.createProject({
  ownerGlobalUserId: "",
  id: "bad",
  title: "Bad",
});
assert.equal(badCreate.ok, false);
assert.equal(badCreate.reason, "invalid_user_project_record");

console.log("OK smoke:user-projects-registry");
