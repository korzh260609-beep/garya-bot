// src/integrations/github/webhook/githubWebhookSignatureVerifier.js
// SG 2.0 — GitHub webhook signature verifier skeleton.
// Purpose: verify GitHub webhook HMAC signatures before any event reaches SG nervous-system dispatch.
// Do not add transport-specific routing, Observation dispatch, AI calls, DB writes, Project Memory writes, or raw payload logging here.

import crypto from "node:crypto";

export const GITHUB_WEBHOOK_SIGNATURE_VERSION = 1;

export const GITHUB_WEBHOOK_SIGNATURE_DECISIONS = Object.freeze({
  VERIFIED: "github_webhook_signature_verified",
  REJECTED: "github_webhook_signature_rejected",
  SKIPPED_DEV_ONLY: "github_webhook_signature_skipped_dev_only",
});

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function buildGithubWebhookSignature({ secret = "", rawBody = "" } = {}) {
  const safeSecret = normalizeText(secret);
  const bodyText = typeof rawBody === "string" || Buffer.isBuffer(rawBody)
    ? rawBody
    : JSON.stringify(rawBody || {});

  if (!safeSecret) {
    return "";
  }

  const hmac = crypto.createHmac("sha256", safeSecret);
  hmac.update(bodyText);
  return `sha256=${hmac.digest("hex")}`;
}

export function verifyGithubWebhookSignature({
  secret = "",
  rawBody = "",
  signature = "",
  allowUnsignedForDevelopment = false,
} = {}) {
  const safeSecret = normalizeText(secret);
  const safeSignature = normalizeText(signature);

  if (!safeSecret) {
    return {
      ok: false,
      version: GITHUB_WEBHOOK_SIGNATURE_VERSION,
      decision: GITHUB_WEBHOOK_SIGNATURE_DECISIONS.REJECTED,
      reason: "missing_github_webhook_secret",
      signatureVerified: false,
      rawPayloadExposed: false,
    };
  }

  if (!safeSignature) {
    if (allowUnsignedForDevelopment === true) {
      return {
        ok: true,
        version: GITHUB_WEBHOOK_SIGNATURE_VERSION,
        decision: GITHUB_WEBHOOK_SIGNATURE_DECISIONS.SKIPPED_DEV_ONLY,
        reason: "unsigned_dev_only_allowed",
        signatureVerified: false,
        rawPayloadExposed: false,
      };
    }

    return {
      ok: false,
      version: GITHUB_WEBHOOK_SIGNATURE_VERSION,
      decision: GITHUB_WEBHOOK_SIGNATURE_DECISIONS.REJECTED,
      reason: "missing_github_signature",
      signatureVerified: false,
      rawPayloadExposed: false,
    };
  }

  const expectedSignature = buildGithubWebhookSignature({ secret: safeSecret, rawBody });
  const verified = timingSafeEqualText(expectedSignature, safeSignature);

  return {
    ok: verified,
    version: GITHUB_WEBHOOK_SIGNATURE_VERSION,
    decision: verified
      ? GITHUB_WEBHOOK_SIGNATURE_DECISIONS.VERIFIED
      : GITHUB_WEBHOOK_SIGNATURE_DECISIONS.REJECTED,
    reason: verified ? null : "github_signature_mismatch",
    signatureVerified: verified,
    rawPayloadExposed: false,
  };
}

export default {
  GITHUB_WEBHOOK_SIGNATURE_VERSION,
  GITHUB_WEBHOOK_SIGNATURE_DECISIONS,
  buildGithubWebhookSignature,
  verifyGithubWebhookSignature,
};
