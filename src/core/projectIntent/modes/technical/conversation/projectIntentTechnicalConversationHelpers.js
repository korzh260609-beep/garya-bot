// src/core/projectIntent/modes/technical/conversation/projectIntentTechnicalConversationHelpers.js
// ============================================================================
// TECHNICAL MODE CONVERSATION HELPER BOUNDARY
//
// INTERFACE MODE NOTE:
// - This module contains legacy phrase/includes follow-up helpers for active
//   file explanation behavior.
// - Exact word/phrase checks are Technical Mode behavior.
// - This is not Human Mode intelligence.
// - Do not add new phrase-bound Human Mode behavior here.
// ============================================================================

import {
  safeText,
} from "../../../projectIntentConversationShared.js";

export function looksLikeFileInnerQuestion(text = "") {
  const t = safeText(text).toLowerCase();
  if (!t) return false;

  const mentionsInnerSubject =
    t.includes("команд") ||
    t.includes("функц") ||
    t.includes("метод") ||
    t.includes("участ") ||
    t.includes("часть") ||
    t.includes("главн") ||
    t.includes("важн") ||
    t.includes("рандом") ||
    t.includes("случайн") ||
    t.includes("section") ||
    t.includes("function") ||
    t.includes("method") ||
    t.includes("command") ||
    t.includes("part") ||
    t.includes("important") ||
    t.includes("main") ||
    t.includes("random");

  const mentionsCurrentFile =
    t.includes("из этого файла") ||
    t.includes("в этом файле") ||
    t.includes("из файла") ||
    t.includes("внутри файла") ||
    t.includes("здесь") ||
    t.includes("тут") ||
    t.includes("в этом") ||
    t.includes("inside this") ||
    t.includes("in this") ||
    t.includes("here");

  const asksForInnerExplanation =
    t.includes("расскажи") ||
    t.includes("объясни") ||
    t.includes("что делает") ||
    t.includes("что здесь") ||
    t.includes("дай информацию") ||
    t.includes("какая") ||
    t.includes("какой");

  const shortFollowup = t.split(/\s+/).filter(Boolean).length <= 10;

  return (
    (mentionsInnerSubject && (mentionsCurrentFile || asksForInnerExplanation || shortFollowup)) ||
    (mentionsCurrentFile && shortFollowup)
  );
}

export function shouldForceActiveFileExplain({ trimmed, followupContext, semanticPlan }) {
  if (followupContext?.isActive !== true) return false;
  if (safeText(followupContext?.objectKind) !== "file") return false;
  if (!looksLikeFileInnerQuestion(trimmed)) return false;

  const intent = safeText(semanticPlan?.intent);
  return (
    !intent ||
    intent === "unknown" ||
    intent === "explain_active" ||
    intent === "explain_target"
  );
}

export default {
  looksLikeFileInnerQuestion,
  shouldForceActiveFileExplain,
};
