// src/core/projectIntent/projectIntentConfirmedActionBuilder.js
// ============================================================================
// STAGE 12B — confirmed project intent action builder (SKELETON)
// Purpose:
// - convert a pending SG-core write intent into a safe structured action
// - avoid writing raw free-text directly into Project Memory
// - keep execution separate from classification / preview / pending store
// IMPORTANT:
// - NO DB writes here
// - NO command execution here
// - NO AI hallucinated content here
// - NO stage completion claims without repository/workflow verification
// - if confidence is low or verification is required, return unsupported
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeText(value) {
  return safeText(value).toLowerCase().replace(/ё/g, "е");
}

function extractStageCompletionClaim(text = "") {
  const raw = safeText(text);
  const normalized = normalizeText(raw);

  if (!raw) return null;

  const stageMatch = raw.match(/(?:этап|stage)\s+([0-9]+[a-zа-я]?(?:\.[0-9]+)?)/i);
  if (!stageMatch) return null;

  const hasCompletedMeaning =
    /\bзаверш[её]н\b/i.test(normalized) ||
    /\bзавершили\b/i.test(normalized) ||
    /\bготов\b/i.test(normalized) ||
    /\bcompleted\b/i.test(normalized) ||
    /\bdone\b/i.test(normalized);

  if (!hasCompletedMeaning) return null;

  return safeText(stageMatch[1]).toUpperCase();
}

export function buildConfirmedProjectIntentAction(pending = {}) {
  const text = safeText(pending?.text);
  const route = pending?.route || null;

  if (!text) {
    return {
      ok: false,
      reason: "empty_pending_text",
      action: null,
    };
  }

  if (route?.routeKey !== "sg_core_internal_write_needs_confirmation") {
    return {
      ok: false,
      reason: "unsupported_route",
      action: null,
    };
  }

  const stageCompletionClaim = extractStageCompletionClaim(text);

  if (stageCompletionClaim) {
    return {
      ok: false,
      reason: "stage_completion_requires_repo_verification",
      action: null,
      verificationRequired: {
        type: "stage_completion",
        stageKey: stageCompletionClaim,
        originalText: text,
      },
    };
  }

  return {
    ok: false,
    reason: "unsupported_free_text_intent",
    action: null,
  };
}

export default {
  buildConfirmedProjectIntentAction,
};
