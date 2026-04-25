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
// - if confidence is low, return unsupported and ask for structured input
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeText(value) {
  return safeText(value).toLowerCase().replace(/ё/g, "е");
}

function extractCompletedStage(text = "") {
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

  const completedStage = extractCompletedStage(text);

  if (completedStage) {
    return {
      ok: true,
      reason: "stage_completed_work_session",
      action: {
        type: "record_project_work_session",
        title: `Stage ${completedStage} completed`,
        goal: `Этап ${completedStage} завершён.`,
        checked: [],
        changed: [],
        decisions: [`Зафиксировано завершение этапа ${completedStage}.`],
        risks: [
          "Запись создана из подтверждённого free-text intent; детали этапа не восстановлены автоматически.",
        ],
        nextSteps: [],
        notes: [`Исходный запрос: ${text}`],
        tags: ["confirmed_intent", "stage_completed", `stage_${completedStage.toLowerCase()}`],
        sourceType: "confirmed_project_intent",
        sourceRef: null,
        relatedPaths: [],
        moduleKey: "project_memory",
        stageKey: completedStage,
        meta: {
          confirmedProjectIntent: true,
          builder: "projectIntentConfirmedActionBuilder",
          builderReason: "stage_completed_work_session",
          originalText: text,
        },
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
