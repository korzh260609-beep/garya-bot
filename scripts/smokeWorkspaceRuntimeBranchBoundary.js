// scripts/smokeWorkspaceRuntimeBranchBoundary.js
// SG 2.0 smoke test for runtime workspace branch boundary.
// Purpose: prove runtime reports default to a dedicated runtime branch instead of the code branch.
// This test does not perform GitHub writes.

import assert from "node:assert/strict";

import {
  DEFAULT_RUNTIME_WORKSPACE_BRANCH,
  getRuntimeWorkspaceBranch,
  WorkspaceChannel,
} from "../src/runtime/workspace/workspaceChannel.js";

assert.equal(DEFAULT_RUNTIME_WORKSPACE_BRANCH, "runtime-observation-state");
assert.equal(getRuntimeWorkspaceBranch(), "runtime-observation-state");

const defaultChannel = new WorkspaceChannel({
  repo: "korzh260609-beep/garya-bot",
  codeBranch: "dev/v2-start",
});

assert.equal(defaultChannel.repo, "korzh260609-beep/garya-bot");
assert.equal(defaultChannel.branch, "runtime-observation-state");
assert.equal(defaultChannel.codeBranch, "dev/v2-start");
assert.notEqual(defaultChannel.branch, defaultChannel.codeBranch);

const explicitChannel = new WorkspaceChannel({
  repo: "korzh260609-beep/garya-bot",
  branch: "custom-runtime-state",
  codeBranch: "dev/v2-start",
});

assert.equal(explicitChannel.branch, "custom-runtime-state");
assert.equal(explicitChannel.codeBranch, "dev/v2-start");
assert.notEqual(explicitChannel.branch, explicitChannel.codeBranch);

const legacyUnsafeChannel = new WorkspaceChannel({
  repo: "korzh260609-beep/garya-bot",
  branch: "dev/v2-start",
  codeBranch: "dev/v2-start",
});

assert.equal(legacyUnsafeChannel.branch, legacyUnsafeChannel.codeBranch);

console.log("OK: runtime workspace defaults to a dedicated runtime branch, not the code branch");
