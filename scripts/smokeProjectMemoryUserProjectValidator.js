// scripts/smokeProjectMemoryUserProjectValidator.js
// SG 2.0 — Project Memory User Project Validator smoke.
//
// This smoke must not touch real PostgreSQL, AI, Telegram, Render, GitHub, or runtime files.

import assert from "node:assert/strict";
import {
  ProjectMemoryUserProjectValidator,
  PROJECT_MEMORY_USER_PROJECT_VALIDATOR_VERSION,
  createProjectMemoryUserProjectValidator,
  buildUserProjectMemoryRef,
  parseProjectMemoryKey,
} from "../src/memory/index.js";

function createMockUserProjectsStore() {
  const projects = new Map([
    [
      "global-user-1:alpha-client",
      {
        id: "alpha-client",
        ownerGlobalUserId: "global-user-1",
        title: "Alpha Client",
        slug: "alpha-client",
        status: "active",
        visibility: "private",
        metadata: {},
        projectMemoryKey: "user_project:global-user-1:alpha-client",
      },
    ],
    [
      "global-user-1:archived-client",
      {
        id: "archived-client",
        ownerGlobalUserId: "global-user-1",
        title: "Archived Client",
        slug: "archived-client",
        status: "archived",
        visibility: "private",
        metadata: {},
        projectMemoryKey: "user_project:global-user-1:archived-client",
      },
    ],
    [
      "global-user-2:alpha-client",
      {
        id: "alpha-client",
        ownerGlobalUserId: "global-user-2",
        title: "Other Alpha",
        slug: "alpha-client",
        status: "active",
        visibility: "private",
        metadata: {},
        projectMemoryKey: "user_project:global-user-2:alpha-client",
      },
    ],
  ]);

  return {
    calls: [],
    async getProject({ ownerGlobalUserId = "", id = "" } = {}) {
      this.calls.push({ ownerGlobalUserId, id });
      const project = projects.get(`${ownerGlobalUserId}:${id}`);
      return {
        ok: Boolean(project),
        reason: project ? null : "user_project_not_found",
        project: project || null,
      };
    },
  };
}

assert.equal(PROJECT_MEMORY_USER_PROJECT_VALIDATOR_VERSION, 1);

const mockStore = createMockUserProjectsStore();
const validator = new ProjectMemoryUserProjectValidator({ userProjectsStore: mockStore });
const validatorFromFactory = createProjectMemoryUserProjectValidator({ userProjectsStore: mockStore });

assert.equal(typeof validatorFromFactory.validateUserProjectRef, "function");

const status = validator.status();
assert.equal(status.ok, true);
assert.equal(status.hasUserProjectsRegistryRead, true);
assert.equal(status.hasProjectMemoryWrites, false);
assert.equal(status.hasProjectMemoryConfirmation, false);
assert.equal(status.hasUserProjectWrites, false);
assert.equal(status.hasTransportLogic, false);
assert.equal(status.hasAICalls, false);
assert.equal(status.hasSourceFetching, false);

const diagnostics = validator.getDiagnostics();
assert.equal(diagnostics.ok, true);
assert.equal(diagnostics.boundaries.readsUserProjectsRegistry, true);
assert.equal(diagnostics.boundaries.writesProjectMemory, false);
assert.equal(diagnostics.boundaries.confirmsProjectMemory, false);
assert.equal(diagnostics.boundaries.createsUserProjects, false);
assert.equal(diagnostics.boundaries.callsAI, false);
assert.equal(diagnostics.boundaries.touchesTelegram, false);
assert.equal(diagnostics.boundaries.fetchesSources, false);
assert.equal(diagnostics.boundaries.infersOwnershipFromText, false);

const validRef = buildUserProjectMemoryRef({
  globalUserId: "global:user-1",
  userProjectId: "alpha-client",
});
assert.equal(validRef.ok, true);
assert.equal(validRef.projectKey, "user_project:global-user-1:alpha-client");

const allowedRead = await validator.validateUserProjectRead({
  actor: { globalUserId: "global:user-1" },
  projectRef: validRef,
});
assert.equal(allowedRead.ok, true);
assert.equal(allowedRead.allowed, true);
assert.equal(allowedRead.project.id, "alpha-client");

const allowedWrite = await validator.validateUserProjectCandidateWrite({
  actor: { globalUserId: "global:user-1" },
  projectRef: validRef,
});
assert.equal(allowedWrite.ok, true);
assert.equal(allowedWrite.allowed, true);
assert.equal(allowedWrite.project.projectMemoryKey, "user_project:global-user-1:alpha-client");

const parsedKeyRead = await validator.validateUserProjectRead({
  actor: { globalUserId: "global-user-1" },
  projectKey: "user_project:global-user-1:alpha-client",
});
assert.equal(parsedKeyRead.ok, true);
assert.equal(parsedKeyRead.allowed, true);

const monarchRead = await validator.validateUserProjectRead({
  actor: { isMonarch: true, globalUserId: "global-user-monarch" },
  projectKey: "user_project:global-user-2:alpha-client",
});
assert.equal(monarchRead.ok, true);
assert.equal(monarchRead.allowed, true);
assert.equal(monarchRead.project.ownerGlobalUserId, "global-user-2");

const ownerMismatch = await validator.validateUserProjectRead({
  actor: { globalUserId: "global-user-2" },
  projectRef: validRef,
});
assert.equal(ownerMismatch.ok, false);
assert.equal(ownerMismatch.allowed, false);
assert.equal(ownerMismatch.reason, "user_project_memory_owner_mismatch");

const missingProject = await validator.validateUserProjectRead({
  actor: { globalUserId: "global-user-1" },
  projectKey: "user_project:global-user-1:missing-client",
});
assert.equal(missingProject.ok, false);
assert.equal(missingProject.allowed, false);
assert.equal(missingProject.reason, "user_project_not_found");

const archivedProject = await validator.validateUserProjectRead({
  actor: { globalUserId: "global-user-1" },
  projectKey: "user_project:global-user-1:archived-client",
});
assert.equal(archivedProject.ok, false);
assert.equal(archivedProject.allowed, false);
assert.equal(archivedProject.reason, "user_project_not_active:archived");

const sgProjectRef = parseProjectMemoryKey("sg");
const sgProjectRejected = await validator.validateUserProjectRead({
  actor: { isMonarch: true },
  projectRef: sgProjectRef,
});
assert.equal(sgProjectRejected.ok, false);
assert.equal(sgProjectRejected.allowed, false);
assert.equal(sgProjectRejected.reason, "project_ref_is_not_user_project");

const invalidProjectKey = await validator.validateUserProjectRead({
  actor: { globalUserId: "global-user-1" },
  projectKey: "bad:key",
});
assert.equal(invalidProjectKey.ok, false);
assert.equal(invalidProjectKey.allowed, false);
assert.equal(invalidProjectKey.reason, "unknown_project_memory_key_format");

const deniedWrite = await validator.validateUserProjectCandidateWrite({
  actor: { globalUserId: "global-user-2" },
  projectRef: validRef,
});
assert.equal(deniedWrite.ok, false);
assert.equal(deniedWrite.allowed, false);
assert.equal(deniedWrite.reason, "user_project_memory_owner_mismatch");

assert.ok(mockStore.calls.length >= 4);

console.log("OK smoke:project-memory-user-project-validator");
