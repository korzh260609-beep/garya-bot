// src/app/githubWebhookRoutes.js
// SG 2.0 — GitHub webhook HTTP route skeleton.
// Purpose: accept signed GitHub webhook events and hand bounded events to Observation dispatch.
// Do not add AI calls, Telegram logic, Project Memory writes, raw payload logging, timers, cron, or GitHub fetching here.

import express from "express";
import { envBool, envStr } from "../config/env.js";
import {
  dispatchGithubWebhookObservation,
  normalizeGithubWebhookEvent,
  verifyGithubWebhookSignature,
} from "../integrations/github/webhook/index.js";

function safeJsonParse(rawBody = "") {
  try {
    return {
      ok: true,
      payload: JSON.parse(rawBody || "{}"),
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "invalid_json",
    };
  }
}

function buildPublicWebhookResult({ ok, status, decision, reason = null, eventType = "" } = {}) {
  return {
    ok: Boolean(ok),
    type: "github_webhook_observation_result",
    status,
    decision,
    reason,
    eventType,
    rawPayloadExposed: false,
  };
}

export function attachGithubWebhookRoutes(app) {
  app.post(
    "/webhooks/github",
    express.raw({ type: "application/json", limit: "256kb" }),
    async (req, res) => {
      const rawBodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from("", "utf8");
      const rawBody = rawBodyBuffer.toString("utf8");
      const secret = envStr("GITHUB_WEBHOOK_SECRET", "");
      const allowUnsignedForDevelopment = envBool("GITHUB_WEBHOOK_ALLOW_UNSIGNED_DEV", false);
      const signature = req.get("x-hub-signature-256") || "";
      const githubEvent = req.get("x-github-event") || "";

      const signatureResult = verifyGithubWebhookSignature({
        secret,
        rawBody: rawBodyBuffer,
        signature,
        allowUnsignedForDevelopment,
      });

      if (!signatureResult.ok) {
        return res.status(401).json(buildPublicWebhookResult({
          ok: false,
          status: "rejected",
          decision: signatureResult.decision,
          reason: signatureResult.reason,
          eventType: githubEvent,
        }));
      }

      const parsed = safeJsonParse(rawBody);
      if (!parsed.ok) {
        return res.status(400).json(buildPublicWebhookResult({
          ok: false,
          status: "rejected",
          decision: "github_webhook_invalid_json",
          reason: parsed.error,
          eventType: githubEvent,
        }));
      }

      const normalized = normalizeGithubWebhookEvent({
        githubEvent,
        payload: parsed.payload,
      });

      if (normalized.ignored === true) {
        return res.status(202).json(buildPublicWebhookResult({
          ok: true,
          status: "ignored",
          decision: "github_webhook_event_ignored",
          reason: normalized.reason,
          eventType: normalized.eventType,
        }));
      }

      if (!normalized.ok) {
        return res.status(422).json(buildPublicWebhookResult({
          ok: false,
          status: "rejected",
          decision: "github_webhook_event_rejected",
          reason: normalized.reason,
          eventType: normalized.eventType,
        }));
      }

      const dispatched = await dispatchGithubWebhookObservation({ normalizedEvent: normalized });

      return res.status(dispatched.ok ? 202 : 500).json(buildPublicWebhookResult({
        ok: dispatched.ok,
        status: dispatched.ok ? "accepted" : "failed",
        decision: dispatched.decision,
        reason: dispatched.reason,
        eventType: normalized.eventType,
      }));
    },
  );

  return app;
}

export default {
  attachGithubWebhookRoutes,
};
