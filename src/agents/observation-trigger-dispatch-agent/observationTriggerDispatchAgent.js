// AGENT NOTE:
// SG 2.0 Observation Trigger Dispatch Agent.
// Purpose: route bounded internal events to already allowlisted observation triggers.
// This agent does not observe by timer and does not act autonomously; it only reacts to explicit input events.
// Do not add Telegram integration, AI calls, memory writes, raw logs, raw provider IDs, autonomous behavior, or mutations here.

import { runObservationTrigger } from "../observation/triggers/index.js";
import {
  OBSERVATION_DISPATCH_EVENT_TYPES,
  getObservationTriggerDispatchConfig,
} from "./observationTriggerDispatchRegistry.js";

const GITHUB_EVIDENCE_EVENT_TYPES = new Set([
  OBSERVATION_DISPATCH_EVENT_TYPES.GITHUB_CI_FINISHED,
  OBSERVATION_DISPATCH_EVENT_TYPES.GITHUB_PR_MERGED,
  OBSERVATION_DISPATCH_EVENT_TYPES.GITHUB_REPOSITORY_UPDATED,
]);

function normalizeText(value) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstText(...values) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return "";
}

function buildLinks({ payload = {}, context = {} } = {}) {
  const payloadLinks = normalizeObject(payload.links);
  const contextLinks = normalizeObject(context.links);
  const commitSha = firstText(
    payload.relatedCommitSha,
    payload.commitSha,
    payload.mergeCommitSha,
    payload.merge_commit_sha,
    payload.headSha,
    payload.head_sha,
    payload.after,
    payload.commit?.sha,
    payload.pull_request?.merge_commit_sha,
    context.relatedCommitSha,
    context.commitSha,
    context.mergeCommitSha,
    context.merge_commit_sha,
    context.headSha,
    context.head_sha,
    payloadLinks.related_commit_sha,
    contextLinks.related_commit_sha,
  );
  const runId = firstText(
    payload.relatedRunId,
    payload.runId,
    payload.run_id,
    payload.workflowRunId,
    payload.workflow_run_id,
    payload.workflow_run?.id,
    context.relatedRunId,
    context.runId,
    context.run_id,
    context.workflowRunId,
    context.workflow_run_id,
    payloadLinks.related_run_id,
    contextLinks.related_run_id,
  );
  const runtimeReportPath = firstText(
    payload.runtimeReportPath,
    payload.runtime_report_path,
    context.runtimeReportPath,
    context.runtime_report_path,
    payloadLinks.runtime_report_path,
    contextLinks.runtime_report_path,
  );

  return {
    runtime_report_path: runtimeReportPath,
    related_commit_sha: commitSha,
    related_run_id: runId,
  };
}

function buildGitHubEvidencePayload({ eventType, payload, context } = {}) {
  if (!GITHUB_EVIDENCE_EVENT_TYPES.has(eventType)) return payload;

  const links = buildLinks({ payload, context });
  const diagnosticsChecks = normalizeArray(payload.diagnosticsChecks).length > 0
    ? normalizeArray(payload.diagnosticsChecks)
    : ["github_actions_commit_runs", "observation_journal_health_latest"];
  const reportNames = normalizeArray(payload.reportNames).length > 0
    ? normalizeArray(payload.reportNames)
    : ["diagnostics-latest", "runtime-status-latest"];
  const commitSha = firstText(
    payload.commitSha,
    payload.relatedCommitSha,
    payload.mergeCommitSha,
    payload.merge_commit_sha,
    payload.headSha,
    payload.head_sha,
    payload.after,
    links.related_commit_sha,
  );

  return {
    ...payload,
    commitSha,
    diagnosticsChecks,
    reportNames,
    links,
    evidence: {
      ...(normalizeObject(payload.evidence)),
      eventType,
      commitSha,
      links,
      exactCommitActionsCheckRequired: true,
      observationJournalHealthRequired: true,
    },
  };
}

function buildGitHubEvidenceContext({ eventType, context, payload } = {}) {
  if (!GITHUB_EVIDENCE_EVENT_TYPES.has(eventType)) return context;

  const links = buildLinks({ payload, context });

  return {
    ...context,
    relatedCommitSha: links.related_commit_sha,
    relatedRunId: links.related_run_id,
    runtimeReportPath: links.runtime_report_path,
    links,
  };
}

function rejected(reason, extra = {}) {
  return {
    ok: false,
    type: "observation_trigger_dispatch_result",
    reason,
    ...extra,
  };
}

export async function runObservationTriggerDispatchAgent(input = {}) {
  const eventType = normalizeText(input.eventType || input.type);
  const rawPayload = normalizeObject(input.payload);
  const rawContext = normalizeObject(input.context);
  const payload = buildGitHubEvidencePayload({ eventType, payload: rawPayload, context: rawContext });
  const context = buildGitHubEvidenceContext({ eventType, context: rawContext, payload });
  const dryRun = input.dryRun === true;
  const dispatchConfig = getObservationTriggerDispatchConfig(eventType);

  if (!dispatchConfig?.enabled) {
    return rejected("observation_dispatch_event_not_allowed", { eventType });
  }

  if (dryRun) {
    return {
      ok: true,
      type: "observation_trigger_dispatch_result",
      mode: "dry_run",
      eventType,
      triggerName: dispatchConfig.triggerName,
      wouldDispatch: true,
      payload,
      context,
    };
  }

  const triggerResult = await runObservationTrigger({
    name: dispatchConfig.triggerName,
    payload,
    context,
  });

  return {
    ok: Boolean(triggerResult?.ok),
    type: "observation_trigger_dispatch_result",
    mode: "dispatch",
    eventType,
    triggerName: dispatchConfig.triggerName,
    triggerResult,
  };
}

export default {
  runObservationTriggerDispatchAgent,
};
