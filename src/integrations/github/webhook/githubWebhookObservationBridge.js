// src/integrations/github/webhook/githubWebhookObservationBridge.js
// SG 2.0 — GitHub webhook to Observation bridge skeleton.
// Purpose: route bounded signed GitHub webhook events into SG Observation dispatch.
// Do not add Express routing, signature verification, AI calls, DB writes, Project Memory writes, raw payload logging, timers, or autonomous behavior here.

import {
  OBSERVATION_DISPATCH_EVENT_TYPES,
  runObservationTriggerDispatchAgent,
} from "../../../agents/observation-trigger-dispatch-agent/index.js";
import {
  GITHUB_WEBHOOK_NORMALIZED_EVENT_TYPES,
} from "./githubWebhookEventNormalizer.js";

export const GITHUB_WEBHOOK_OBSERVATION_BRIDGE_VERSION = 1;

export const GITHUB_WEBHOOK_OBSERVATION_BRIDGE_DECISIONS = Object.freeze({
  DISPATCHED: "github_webhook_observation_dispatched",
  IGNORED: "github_webhook_observation_ignored",
  REJECTED: "github_webhook_observation_rejected",
});

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function getGithubWebhookObservationBridgeBoundaries() {
  return {
    eventDrivenOnly: true,
    acceptsNormalizedEventsOnly: true,
    callsObservationDispatch: true,
    writesProjectMemory: false,
    callsAI: false,
    touchesTelegram: false,
    fetchesGitHub: false,
    fetchesRender: false,
    usesCron: false,
    usesSchedule: false,
    exposesRawPayload: false,
  };
}

export async function dispatchGithubWebhookObservation({ normalizedEvent = {}, context = {} } = {}) {
  const safeEvent = normalizePlainObject(normalizedEvent);
  const boundaries = getGithubWebhookObservationBridgeBoundaries();

  if (!safeEvent.ok) {
    return {
      ok: false,
      version: GITHUB_WEBHOOK_OBSERVATION_BRIDGE_VERSION,
      decision: GITHUB_WEBHOOK_OBSERVATION_BRIDGE_DECISIONS.REJECTED,
      reason: safeEvent.reason || "normalized_event_not_ok",
      dispatched: false,
      boundaries,
      rawPayloadExposed: false,
    };
  }

  if (safeEvent.ignored === true || safeEvent.normalized !== true) {
    return {
      ok: true,
      version: GITHUB_WEBHOOK_OBSERVATION_BRIDGE_VERSION,
      decision: GITHUB_WEBHOOK_OBSERVATION_BRIDGE_DECISIONS.IGNORED,
      reason: safeEvent.reason || "normalized_event_ignored",
      dispatched: false,
      boundaries,
      rawPayloadExposed: false,
    };
  }

  if (safeEvent.eventType !== GITHUB_WEBHOOK_NORMALIZED_EVENT_TYPES.PR_MERGED) {
    return {
      ok: false,
      version: GITHUB_WEBHOOK_OBSERVATION_BRIDGE_VERSION,
      decision: GITHUB_WEBHOOK_OBSERVATION_BRIDGE_DECISIONS.REJECTED,
      reason: "unsupported_normalized_github_webhook_event",
      dispatched: false,
      boundaries,
      rawPayloadExposed: false,
    };
  }

  const dispatchResult = await runObservationTriggerDispatchAgent({
    eventType: OBSERVATION_DISPATCH_EVENT_TYPES.GITHUB_PR_MERGED,
    payload: {
      githubWebhook: {
        eventType: safeEvent.eventType,
        prNumber: safeEvent.payload?.prNumber || null,
        title: safeEvent.payload?.title || "",
        sourceRef: safeEvent.payload?.sourceRef || "",
        repositoryFullName: safeEvent.payload?.repositoryFullName || "",
        baseBranch: safeEvent.payload?.baseBranch || "",
        mergeCommitSha: safeEvent.payload?.mergeCommitSha || "",
        mergedAt: safeEvent.payload?.mergedAt || "",
      },
    },
    context,
  });

  return {
    ok: Boolean(dispatchResult?.ok),
    version: GITHUB_WEBHOOK_OBSERVATION_BRIDGE_VERSION,
    decision: dispatchResult?.ok
      ? GITHUB_WEBHOOK_OBSERVATION_BRIDGE_DECISIONS.DISPATCHED
      : GITHUB_WEBHOOK_OBSERVATION_BRIDGE_DECISIONS.REJECTED,
    reason: dispatchResult?.ok ? null : dispatchResult?.reason || "observation_dispatch_failed",
    dispatched: Boolean(dispatchResult?.ok),
    dispatchResult,
    boundaries,
    rawPayloadExposed: false,
  };
}

export default {
  GITHUB_WEBHOOK_OBSERVATION_BRIDGE_VERSION,
  GITHUB_WEBHOOK_OBSERVATION_BRIDGE_DECISIONS,
  getGithubWebhookObservationBridgeBoundaries,
  dispatchGithubWebhookObservation,
};
