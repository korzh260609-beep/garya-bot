// AGENT NOTE:
// Smoke test for SG 2.0 GitHub Actions formatter.
// Purpose: verify normalized Actions visibility without network calls.

import assert from "node:assert/strict";
import { formatGitHubActionsResult } from "../src/tools/githubActionsFormatter.js";

function testRunsFormatting() {
  const formatted = formatGitHubActionsResult({
    method: "GET",
    path: "/repos/korzh260609-beep/garya-bot/actions/runs",
    query: { branch: "dev/v2-start", event: "push" },
    data: {
      total_count: 1,
      workflow_runs: [
        {
          id: 157,
          name: "SG2 Smoke",
          display_title: "docs: document render integration environment variables",
          workflow_id: 123,
          run_number: 157,
          run_attempt: 1,
          head_branch: "dev/v2-start",
          status: "completed",
          conclusion: "success",
          event: "push",
          head_sha: "99dfde190ff79c174095ff44739e0e1590fec2b2",
          head_commit: { message: "docs: document render integration environment variables" },
          actor: { login: "korzh260609-beep" },
          html_url: "https://github.com/korzh260609-beep/garya-bot/actions/runs/157",
          jobs_url: "https://api.github.com/repos/korzh260609-beep/garya-bot/actions/runs/157/jobs",
          logs_url: "https://api.github.com/repos/korzh260609-beep/garya-bot/actions/runs/157/logs",
          created_at: "2026-05-06T11:00:14Z",
          updated_at: "2026-05-06T11:00:35Z",
          run_started_at: "2026-05-06T11:00:15Z",
        },
      ],
    },
  });

  assert.equal(formatted.type, "github_actions_runs");
  assert.equal(formatted.total_count, 1);
  assert.equal(formatted.returned_count, 1);
  assert.equal(formatted.branch, "dev/v2-start");
  assert.equal(formatted.conclusions.success, 1);
  assert.equal(formatted.runs[0].workflow_name, "SG2 Smoke");
  assert.equal(formatted.runs[0].commit_sha, "99dfde190ff79c174095ff44739e0e1590fec2b2");
  assert.ok(formatted.runs[0].jobs_url);
  assert.ok(formatted.runs[0].logs_url);
}

function testJobsFormatting() {
  const formatted = formatGitHubActionsResult({
    method: "GET",
    path: "/repos/korzh260609-beep/garya-bot/actions/runs/157/jobs",
    data: {
      total_count: 1,
      jobs: [
        {
          id: 9001,
          run_id: 157,
          name: "SG2 syntax and dependency smoke",
          status: "completed",
          conclusion: "success",
          runner_name: "GitHub Actions 1",
          runner_group_name: "GitHub Actions",
          html_url: "https://github.com/korzh260609-beep/garya-bot/actions/runs/157/job/9001",
          started_at: "2026-05-06T11:00:16Z",
          completed_at: "2026-05-06T11:00:35Z",
          steps: [
            { name: "Checkout repository", status: "completed", conclusion: "success", number: 1 },
            { name: "Check GitHub tool syntax", status: "completed", conclusion: "success", number: 2 },
          ],
        },
      ],
    },
  });

  assert.equal(formatted.type, "github_actions_run_jobs");
  assert.equal(formatted.total_count, 1);
  assert.equal(formatted.conclusions.success, 1);
  assert.equal(formatted.jobs[0].steps_total, 2);
  assert.equal(formatted.jobs[0].steps_failed, 0);
  assert.equal(formatted.jobs[0].steps[1].name, "Check GitHub tool syntax");
}

function testWorkflowsFormatting() {
  const formatted = formatGitHubActionsResult({
    method: "GET",
    path: "/repos/korzh260609-beep/garya-bot/actions/workflows",
    data: {
      total_count: 1,
      workflows: [
        {
          id: 123,
          name: "SG2 Smoke",
          path: ".github/workflows/sg2-smoke.yml",
          state: "active",
          html_url: "https://github.com/korzh260609-beep/garya-bot/actions/workflows/sg2-smoke.yml",
          badge_url: "https://github.com/korzh260609-beep/garya-bot/actions/workflows/sg2-smoke.yml/badge.svg",
        },
      ],
    },
  });

  assert.equal(formatted.type, "github_actions_workflows");
  assert.equal(formatted.total_count, 1);
  assert.equal(formatted.workflows[0].name, "SG2 Smoke");
  assert.equal(formatted.workflows[0].state, "active");
}

function testArtifactsFormatting() {
  const formatted = formatGitHubActionsResult({
    method: "GET",
    path: "/repos/korzh260609-beep/garya-bot/actions/runs/157/artifacts",
    data: {
      total_count: 1,
      artifacts: [
        {
          id: 77,
          name: "diagnostics-report",
          size_in_bytes: 2048,
          expired: false,
          created_at: "2026-05-06T11:00:35Z",
          expires_at: "2026-08-04T11:00:35Z",
          archive_download_url: "https://api.github.com/repos/korzh260609-beep/garya-bot/actions/artifacts/77/zip",
        },
      ],
    },
  });

  assert.equal(formatted.type, "github_actions_run_artifacts");
  assert.equal(formatted.total_count, 1);
  assert.equal(formatted.artifacts[0].name, "diagnostics-report");
  assert.equal(formatted.artifacts[0].expired, false);
}

function testNonActionsPath() {
  const formatted = formatGitHubActionsResult({
    method: "GET",
    path: "/repos/korzh260609-beep/garya-bot/contents/package.json",
    data: {},
  });

  assert.equal(formatted, null);
}

testRunsFormatting();
testJobsFormatting();
testWorkflowsFormatting();
testArtifactsFormatting();
testNonActionsPath();

console.log("smokeGithubActionsFormatter: ok");
