// scripts/smokeObservationDispatchGithubEvents.js
// SG 2.0 smoke test for GitHub event dispatch allowlist and evidence propagation.

import assert from "node:assert/strict";

import {
  OBSERVATION_DISPATCH_EVENT_TYPES,
  getObservationTriggerDispatchConfig,
  runObservationTriggerDispatchAgent,
} from "../src/agents/observation-trigger-dispatch-agent/index.js";

for (const eventType of [
  OBSERVATION_DISPATCH_EVENT_TYPES.GITHUB_PR_MERGED,
  OBSERVATION_DISPATCH_EVENT_TYPES.GITHUB_CI_FINISHED,
  OBSERVATION_DISPATCH_EVENT_TYPES.GITHUB_REPOSITORY_UPDATED,
]) {
  const config = getObservationTriggerDispatchConfig(eventType);
  const result = await runObservationTriggerDispatchAgent({
    eventType,
    dryRun: true,
    payload: {
      merge_commit_sha: "9b9eb30025139fe28ede46a547d1ce985ea6045c",
      workflow_run: {
        id: 26021460823,
      },
      runtimeReportPath: "runtime/observation/latest/observation-journal-health-latest.json",
    },
  });

  assert.equal(config.eventType, eventType);
  assert.equal(config.enabled, true);
  assert.equal(result.ok, true);
  assert.equal(result.type, "observation_trigger_dispatch_result");
  assert.equal(result.mode, "dry_run");
  assert.equal(result.eventType, eventType);
  assert.equal(result.triggerName, config.triggerName);
  assert.equal(result.wouldDispatch, true);
  assert.equal(result.payload.commitSha, "9b9eb30025139fe28ede46a547d1ce985ea6045c");
  assert.deepEqual(result.payload.diagnosticsChecks, [
    "github_actions_commit_runs",
    "observation_journal_health_latest",
  ]);
  assert.deepEqual(result.payload.reportNames, [
    "diagnostics-latest",
    "runtime-status-latest",
  ]);
  assert.equal(result.payload.links.related_commit_sha, "9b9eb30025139fe28ede46a547d1ce985ea6045c");
  assert.equal(result.payload.links.related_run_id, "26021460823");
  assert.equal(result.payload.links.runtime_report_path, "runtime/observation/latest/observation-journal-health-latest.json");
  assert.equal(result.payload.evidence.exactCommitActionsCheckRequired, true);
  assert.equal(result.payload.evidence.observationJournalHealthRequired, true);
  assert.equal(result.context.relatedCommitSha, "9b9eb30025139fe28ede46a547d1ce985ea6045c");
  assert.equal(result.context.relatedRunId, "26021460823");
  assert.equal(result.context.runtimeReportPath, "runtime/observation/latest/observation-journal-health-latest.json");
}

console.log("OK: GitHub events are allowlisted for observation dispatch with complete evidence links");
