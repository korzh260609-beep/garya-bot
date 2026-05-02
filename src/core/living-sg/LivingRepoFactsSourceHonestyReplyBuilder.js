// src/core/living-sg/LivingRepoFactsSourceHonestyReplyBuilder.js
// ============================================================================
// LIVING SG — Repo Facts Source-State Reply Builder
//
// Purpose:
// - keep technical source-honesty guard decisions separate from user-facing text;
// - report source state and verified snapshot summary without factNeed phrase templates;
// - avoid leaking internal fallback/debug reasons into transport-agnostic user-facing responses.
//
// Boundaries:
// - transport-agnostic Living SG core text only;
// - no factNeed-to-phrase mapping;
// - no Telegram-specific behavior;
// - no repository reads;
// - no repository writes;
// - no source calls;
// - no executor;
// - no AI call;
// - no slash-command routing;
// - no keyword/phrase router.
// ============================================================================

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.replace(/\s+/g, " ").slice(0, 240);
}

function safeNumber(value, fallback = "not_confirmed") {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : fallback;
}

function hasConfirmedSourceEnvelope(sourceResultEnvelope = null) {
  return (
    isPlainObject(sourceResultEnvelope) &&
    sourceResultEnvelope.canClaimVerifiedFacts === true &&
    sourceResultEnvelope?.confirmation?.status === "confirmed"
  );
}

function getProjectMap(sourceResultEnvelope = null) {
  const payload = sourceResultEnvelope?.payload;
  if (!isPlainObject(payload)) return null;
  if (isPlainObject(payload.projectMap)) return payload.projectMap;
  if (isPlainObject(payload.payload?.projectMap)) return payload.payload.projectMap;
  return null;
}

export function buildRepoFactsSourceHonestyBlockedReply({
  sourceResultEnvelope = null,
  guardResult = null,
} = {}) {
  const confirmed = hasConfirmedSourceEnvelope(sourceResultEnvelope);
  const projectMap = getProjectMap(sourceResultEnvelope);
  const repo = projectMap?.repo || {};
  const totals = projectMap?.totals || {};
  const factNeed = safeText(guardResult?.factNeed || "other_repo_fact");

  const lines = [
    `source_status: ${confirmed ? "confirmed" : "unavailable"}`,
    `source_scope: ${safeText(repo.fullName, "unknown")}/${safeText(repo.branch, "unknown")}`,
    `requested_fact: ${factNeed}`,
    "requested_fact_status: unavailable_in_verified_snapshot",
  ];

  if (projectMap) {
    lines.push(
      "verified_snapshot:",
      `- files_total: ${safeNumber(totals.files)}`,
      `- modules_total: ${safeNumber(totals.modules)}`,
      `- dependencies_total: ${safeNumber(totals.dependencies)}`,
      `- structure_complete: ${totals.structureComplete === true ? "true" : "false"}`
    );
  }

  return {
    handled: true,
    source: "LivingRepoFactsSourceHonestyReplyBuilder",
    reason: "source_state_reply_for_blocked_repo_facts",
    text: lines.filter(Boolean).join("\n"),
    metadata: {
      userFacingReplyBuiltSeparately: true,
      technicalGuardTextHidden: true,
      transportAgnosticUserFacingReply: true,
      noFactNeedPhraseTemplates: true,
      factNeed,
    },
  };
}

export default {
  buildRepoFactsSourceHonestyBlockedReply,
};
