// scripts/smokePostMergeActionsDiscoveryWorkflow.js
// SG 2.0 smoke test for the post-merge GitHub Actions discovery workflow.
// Purpose: prove that dev/v2-start has an explicit push workflow so post-merge evidence can exist.
// Read-only local file inspection. No GitHub fetch, no repo mutation, no DB, no Telegram, no AI.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflowPath = ".github/workflows/sg2-post-merge-actions-discovery-smoke.yml";
const workflow = readFileSync(workflowPath, "utf8");

assert.equal(workflow.includes("name: SG2 Post-Merge Actions Discovery Smoke"), true);
assert.equal(workflow.includes("pull_request:"), true);
assert.equal(workflow.includes("push:"), true);
assert.equal(workflow.includes("workflow_dispatch:"), true);
assert.equal(workflow.includes("- dev/v2-start"), true);
assert.equal(workflow.includes("contents: read"), true);
assert.equal(workflow.includes("actions: read"), true);
assert.equal(workflow.includes("npm run smoke:post-merge-actions-discovery-workflow"), true);
assert.equal(workflow.includes("npm run smoke:github-actions-commit-runs-check"), true);
assert.equal(workflow.includes("contents: write"), false);
assert.equal(workflow.includes("pull-requests: write"), false);
assert.equal(workflow.includes("actions: write"), false);

console.log("smokePostMergeActionsDiscoveryWorkflow: ok");
