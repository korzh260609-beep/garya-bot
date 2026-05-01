// src/core/living-sg/LivingSourceResultSystemMessage.js
// ============================================================================
// LIVING SG — Source Result System Message Builder Skeleton
//
// Purpose:
// - convert a provided sourceResult envelope into prompt-safe system evidence;
// - keep prompt evidence separate from planner metadata;
// - make confirmed vs missing/invalid/stale/unconfirmed status explicit;
// - keep repository writes blocked.
//
// Hard boundaries:
// - no source calls here;
// - no repository reads here;
// - no repository writes here;
// - no executor;
// - no RepoStateAgent runtime connection;
// - no Technical Mode expansion;
// - no slash-command dependency;
// - no promptAssembly runtime wiring yet.
// ============================================================================

import {
  LIVING_SOURCE_RESULT_CONFIRMATION_STATUS,
} from "./LivingSourceResultEnvelope.js";

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.replace(/\s+/g, " ").slice(0, 240);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getConfirmationStatus(envelope = null) {
  return safeText(envelope?.confirmation?.status, "missing");
}

function getTargetSummary(target = null) {
  if (!isPlainObject(target)) return safeText(target);

  const repository = safeText(target.repository, "");
  const ref = safeText(target.ref, "");
  const path = safeText(target.path, "");
  const scope = safeText(target.scope, "");

  return [
    repository ? `repository=${repository}` : null,
    ref ? `ref=${ref}` : null,
    path ? `path=${path}` : null,
    scope ? `scope=${scope}` : null,
  ].filter(Boolean).join("; ") || "-";
}

function envelopeCanClaimVerifiedFacts(envelope = null) {
  return (
    isPlainObject(envelope) &&
    envelope.canClaimVerifiedFacts === true &&
    getConfirmationStatus(envelope) ===
      LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.CONFIRMED
  );
}

function buildMissingEnvelopeMessage() {
  return {
    role: "system",
    content: [
      "SOURCE RESULT SYSTEM EVIDENCE:",
      "status=missing",
      "verified=false",
      "canClaimVerifiedFacts=false",
      "canAuthorizeWrite=false",
      "sourceResultEnvelopePresent=false",
      "Instruction: No sourceResult envelope was provided. Do not present repository/source facts as verified in the current runtime.",
      "Instruction: Use source-honest wording and explain that verified source evidence is missing if source facts are requested.",
      "Safety: This message does not execute sources, read repositories, write repositories, deploy, or authorize any state-changing action.",
      "Safety: A confirmed read result never authorizes write actions.",
    ].join("\n"),
  };
}

export function buildLivingSourceResultSystemMessage(input = {}) {
  const envelope = isPlainObject(input.sourceResultEnvelope)
    ? input.sourceResultEnvelope
    : isPlainObject(input.sourceResult)
      ? input.sourceResult
      : null;

  if (!envelope) {
    return buildMissingEnvelopeMessage();
  }

  const confirmationStatus = getConfirmationStatus(envelope);
  const verified = envelopeCanClaimVerifiedFacts(envelope);
  const kind = safeText(envelope.kind, "unknown");
  const target = getTargetSummary(envelope.target);
  const freshnessStatus = safeText(envelope?.freshness?.status, "unknown");
  const checkedAt = safeText(envelope?.freshness?.checkedAt, "-");
  const sourceUpdatedAt = safeText(envelope?.freshness?.sourceUpdatedAt, "-");
  const confirmedBy = safeText(envelope?.confirmation?.confirmedBy, "-");
  const reason = safeText(envelope?.confirmation?.reason, "-");

  return {
    role: "system",
    content: [
      "SOURCE RESULT SYSTEM EVIDENCE:",
      `status=${confirmationStatus}`,
      `verified=${String(verified)}`,
      `canClaimVerifiedFacts=${String(verified)}`,
      "canAuthorizeWrite=false",
      "sourceResultEnvelopePresent=true",
      `kind=${kind}`,
      `target=${target}`,
      `freshness.status=${freshnessStatus}`,
      `freshness.checkedAt=${checkedAt}`,
      `freshness.sourceUpdatedAt=${sourceUpdatedAt}`,
      `confirmation.confirmedBy=${confirmedBy}`,
      `confirmation.reason=${reason}`,
      verified
        ? "Instruction: This confirmed sourceResult envelope may support verified repository/source claims only for the stated target."
        : "Instruction: This sourceResult envelope is not confirmed for verified claims. Use source-honest wording and do not present repository/source facts as verified.",
      "Instruction: expectedSourceResultEnvelope, planner metadata, and source-proof metadata are not proof.",
      "Safety: This message does not execute sources, read repositories, write repositories, deploy, or authorize any state-changing action.",
      "Safety: A confirmed read result never authorizes write actions.",
    ].join("\n"),
  };
}

export default {
  buildLivingSourceResultSystemMessage,
};
