// scripts/smokeUserProjectRuntimeContext.js
// SG 2.0 — User Project Runtime Context smoke.
// This smoke must stay deterministic, offline, and must not touch the real DB/network.

import assert from "node:assert/strict";
import {
  UserProjectRuntimeContextResolver,
  buildUserProjectRuntimeContextStatus,
  getUserProjectRuntimeContextBoundaries,
} from "../src/projects/index.js";

function createStoreMock(projects = {}) {
  const calls = [];

  return {
    calls,
    async getProject(input = {}) {
      calls.push(input);
      const key = `${input.ownerGlobalUserId}:${input.id}`;
      const project = projects[key] || null;

      return {
        ok: Boolean(project),
        reason: project ? null : "user_project_not_found",
        project,
      };
    },
  };
}

const boundaries = getUserProjectRuntimeContextBoundaries();
assert.equal(boundaries.explicitProjectContextOnly, true);
assert.equal(boundaries.infersFromNaturalLanguage, false);
assert.equal(boundaries.readsProjectMemory, false);
assert.equal(boundaries.writesProjectMemory, false);
assert.equal(boundaries.confirmsProjectMemory, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.touchesTelegram, false);
assert.equal(boundaries.fetchesSources, false);

const status = buildUserProjectRuntimeContextStatus();
assert.equal(status.ok, true);
assert.equal(status.runtimeConnected, false);
assert.equal(status.boundaries.writesProjectMemory, false);

const activeProject = {
  id: "demo-project",
  ownerGlobalUserId: "global-owner",
  title: "Demo Project",
  slug: "demo-project",
  status: "active",
  visibility: "private",
  metadata: {},
  projectMemoryKey: "user_project:global-owner:demo-project",
};

const inactiveProject = {
  ...activeProject,
  id: "paused-project",
  status: "paused",
  projectMemoryKey: "user_project:global-owner:paused-project",
};

const store = createStoreMock({
  "global-owner:demo-project": activeProject,
  "global-owner:paused-project": inactiveProject,
});

const resolver = new UserProjectRuntimeContextResolver({ store });
assert.equal(resolver.status().ok, true);

const resolved = await resolver.resolveExplicitUserProjectContext({
  actor: {
    globalUserId: "global-owner",
    platform: "telegram",
    platformUserId: "111",
    role: "citizen",
    isMonarch: false,
  },
  ownerGlobalUserId: "global-owner",
  userProjectId: "demo-project",
});

assert.equal(resolved.ok, true);
assert.equal(resolved.reason, null);
assert.equal(resolved.projectKey, "user_project:global-owner:demo-project");
assert.equal(resolved.actor.globalUserId, "global-owner");
assert.equal(resolved.project.id, "demo-project");
assert.equal(resolved.boundaries.readsProjectMemory, false);
assert.equal(store.calls.length, 1);
assert.deepEqual(store.calls[0], { ownerGlobalUserId: "global-owner", id: "demo-project" });

const monarchResolved = await resolver.resolveExplicitUserProjectContext({
  actor: {
    globalUserId: "global-monarch",
    platform: "telegram",
    platformUserId: "260609",
    role: "monarch",
    isMonarch: true,
  },
  ownerGlobalUserId: "global-owner",
  userProjectId: "demo-project",
});

assert.equal(monarchResolved.ok, true);
assert.equal(monarchResolved.projectKey, "user_project:global-owner:demo-project");

const mismatch = await resolver.resolveExplicitUserProjectContext({
  actor: {
    globalUserId: "global-other",
    platform: "telegram",
    role: "citizen",
    isMonarch: false,
  },
  ownerGlobalUserId: "global-owner",
  userProjectId: "demo-project",
});

assert.equal(mismatch.ok, false);
assert.equal(mismatch.reason, "user_project_runtime_context_owner_mismatch");
assert.equal(mismatch.projectKey, "");

const missingActor = await resolver.resolveExplicitUserProjectContext({
  actor: {},
  ownerGlobalUserId: "global-owner",
  userProjectId: "demo-project",
});

assert.equal(missingActor.ok, false);
assert.equal(missingActor.reason, "missing_actor_global_user_id");

const notFound = await resolver.resolveExplicitUserProjectContext({
  actor: { globalUserId: "global-owner" },
  ownerGlobalUserId: "global-owner",
  userProjectId: "unknown-project",
});

assert.equal(notFound.ok, false);
assert.equal(notFound.reason, "user_project_not_found");

const inactive = await resolver.resolveExplicitUserProjectContext({
  actor: { globalUserId: "global-owner" },
  ownerGlobalUserId: "global-owner",
  userProjectId: "paused-project",
});

assert.equal(inactive.ok, false);
assert.equal(inactive.reason, "user_project_not_active");
assert.equal(inactive.boundaries.writesProjectMemory, false);

console.log("smokeUserProjectRuntimeContext: ok");
