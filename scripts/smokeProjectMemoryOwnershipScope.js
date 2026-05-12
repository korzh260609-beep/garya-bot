// scripts/smokeProjectMemoryOwnershipScope.js
// SG 2.0 — Project Memory ownership / multi-project scope smoke.
// This smoke must stay deterministic, offline, and must not touch DB/network.

import assert from "node:assert/strict";
import {
  PROJECT_MEMORY_OWNER_TYPES,
  PROJECT_MEMORY_VISIBILITY,
  SG_PROJECT_MEMORY_KEY,
  buildSgProjectMemoryRef,
  buildUserProjectMemoryKey,
  buildUserProjectMemoryRef,
  canReadProjectMemory,
  canWriteProjectMemoryCandidate,
  getMemoryModuleStatus,
  parseProjectMemoryKey,
} from "../src/memory/index.js";

const moduleStatus = getMemoryModuleStatus();
assert.equal(moduleStatus.ok, true);
assert.equal(moduleStatus.hasProjectMemoryOwnershipBoundary, true);
assert.equal(moduleStatus.principles.oneUserMayOwnManyProjects, true);
assert.equal(moduleStatus.principles.projectMemorySeparatesSgAndUserProjects, true);
assert.equal(moduleStatus.hasTransportLogic, false);
assert.equal(moduleStatus.hasAICalls, false);

const sgProject = buildSgProjectMemoryRef();
assert.equal(sgProject.ok, true);
assert.equal(sgProject.ownerType, PROJECT_MEMORY_OWNER_TYPES.SG_PROJECT);
assert.equal(sgProject.ownerRef, "sg");
assert.equal(sgProject.projectKey, SG_PROJECT_MEMORY_KEY);
assert.equal(sgProject.visibility, PROJECT_MEMORY_VISIBILITY.SYSTEM_INTERNAL);

const parsedSg = parseProjectMemoryKey("sg");
assert.equal(parsedSg.ok, true);
assert.equal(parsedSg.ownerType, PROJECT_MEMORY_OWNER_TYPES.SG_PROJECT);
assert.equal(parsedSg.projectKey, "sg");

const userProjectAlpha = buildUserProjectMemoryRef({
  globalUserId: "global:user-1",
  userProjectId: "alpha-client",
});
const userProjectBeta = buildUserProjectMemoryRef({
  globalUserId: "global:user-1",
  userProjectId: "beta-shop",
});
const otherUserProject = buildUserProjectMemoryRef({
  globalUserId: "global:user-2",
  userProjectId: "alpha-client",
});

assert.equal(userProjectAlpha.ok, true);
assert.equal(userProjectBeta.ok, true);
assert.equal(otherUserProject.ok, true);
assert.notEqual(userProjectAlpha.projectKey, userProjectBeta.projectKey);
assert.notEqual(userProjectAlpha.projectKey, otherUserProject.projectKey);
assert.equal(userProjectAlpha.ownerType, PROJECT_MEMORY_OWNER_TYPES.USER_PROJECT);
assert.equal(userProjectAlpha.ownerRef, "global:user-1");
assert.equal(userProjectAlpha.userProjectId, "alpha-client");
assert.equal(userProjectAlpha.visibility, PROJECT_MEMORY_VISIBILITY.PRIVATE_USER_PROJECT);
assert.equal(userProjectAlpha.projectKey.startsWith("user_project:"), true);

const keyOnly = buildUserProjectMemoryKey({
  globalUserId: "Global User 1",
  userProjectId: "My Project #1",
});
assert.equal(keyOnly.ok, true);
assert.equal(keyOnly.projectKey, "user_project:global-user-1:my-project-1");

const missingKey = buildUserProjectMemoryKey({ globalUserId: "global:user-1" });
assert.equal(missingKey.ok, false);
assert.equal(missingKey.reason, "missing_global_user_id_or_user_project_id");

const parsedUserProject = parseProjectMemoryKey(userProjectAlpha.projectKey);
assert.equal(parsedUserProject.ok, true);
assert.equal(parsedUserProject.ownerType, PROJECT_MEMORY_OWNER_TYPES.USER_PROJECT);
assert.equal(parsedUserProject.ownerRef, "global:user-1");
assert.equal(parsedUserProject.userProjectId, "alpha-client");

const parsedUnknown = parseProjectMemoryKey("some_random_project");
assert.equal(parsedUnknown.ok, false);
assert.equal(parsedUnknown.reason, "unknown_project_memory_key_format");

const monarchCanReadSg = canReadProjectMemory({
  actor: { globalUserId: "global:monarch", isMonarch: true },
  projectRef: sgProject,
});
assert.equal(monarchCanReadSg.allowed, true);

const guestCannotReadSg = canReadProjectMemory({
  actor: { globalUserId: "global:user-1", role: "guest" },
  projectRef: sgProject,
});
assert.equal(guestCannotReadSg.allowed, false);
assert.equal(guestCannotReadSg.reason, "sg_project_memory_requires_monarch_or_system");

const ownerCanReadOwnProject = canReadProjectMemory({
  actor: { globalUserId: "global:user-1", role: "guest" },
  projectRef: userProjectAlpha,
});
assert.equal(ownerCanReadOwnProject.allowed, true);

const ownerCanReadSecondOwnProject = canReadProjectMemory({
  actor: { globalUserId: "global:user-1", role: "guest" },
  projectRef: userProjectBeta,
});
assert.equal(ownerCanReadSecondOwnProject.allowed, true);

const userCannotReadOtherUserProject = canReadProjectMemory({
  actor: { globalUserId: "global:user-1", role: "guest" },
  projectRef: otherUserProject,
});
assert.equal(userCannotReadOtherUserProject.allowed, false);
assert.equal(userCannotReadOtherUserProject.reason, "user_project_memory_owner_mismatch");

const monarchCanReadUserProject = canReadProjectMemory({
  actor: { globalUserId: "global:monarch", isMonarch: true },
  projectRef: otherUserProject,
});
assert.equal(monarchCanReadUserProject.allowed, true);

const writeCheck = canWriteProjectMemoryCandidate({
  actor: { globalUserId: "global:user-1", role: "guest" },
  projectRef: userProjectAlpha,
});
assert.equal(writeCheck.allowed, true);

console.log("smokeProjectMemoryOwnershipScope: ok");
