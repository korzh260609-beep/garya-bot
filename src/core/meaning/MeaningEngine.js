// src/core/meaning/MeaningEngine.js

import { createEmptyMeaning, MEANING_ACTION, MEANING_DOMAIN, MEANING_CONFIDENCE } from "./MeaningTypes.js";
import { analyzeContextContinuity } from "./ContextContinuityEngine.js";

function safeText(v) {
  return String(v ?? "").trim();
}

function detectDomain({ text = "", hasActiveProjectSession = false } = {}) {
  const s = safeText(text).toLowerCase();
  if (hasActiveProjectSession) return MEANING_DOMAIN.PROJECT;
  if (/\b(project|repo|github|workflow|roadmap|этап|stage)\b/i.test(s)) return MEANING_DOMAIN.PROJECT;
  if (/\b(memory|памят|сохрани|запиши)\b/i.test(s)) return MEANING_DOMAIN.MEMORY;
  if (/\b(code|код|function|class|bug|error)\b/i.test(s)) return MEANING_DOMAIN.CODE;
  return MEANING_DOMAIN.GENERAL;
}

function extractStageId(text = "") {
  const m = safeText(text).match(/(?:stage|этап)\s*([0-9]+[a-zа-я]?(?:\.[0-9]+)?)/i);
  return m ? m[1].toUpperCase() : null;
}

export class MeaningEngine {
  understand({ text = "", hasActiveProjectSession = false, previousContext = null } = {}) {
    const meaning = createEmptyMeaning({ source: "MeaningEngine" });
    const domain = detectDomain({ text, hasActiveProjectSession });

    meaning.domain = domain;
    meaning.confidence = MEANING_CONFIDENCE.MEDIUM;
    meaning.confidenceScore = 0.6;

    const continuity = analyzeContextContinuity({ text, previousContext });
    meaning.contextContinuity = continuity;

    if (domain === MEANING_DOMAIN.PROJECT) {
      const stageId = extractStageId(text);

      if (!stageId) {
        if (continuity.shouldAskClarification) {
          meaning.intent = "clarify_project_target";
          meaning.enoughInformation = false;
          meaning.missingInformation = ["stage_id"];
          meaning.suggestedAction = MEANING_ACTION.CLARIFY;
          meaning.userMeaning = "user did not specify target and context is weak";
          return meaning;
        }
      }

      if (stageId) {
        meaning.intent = "inspect_project_stage";
        meaning.enoughInformation = true;
        meaning.suggestedAction = MEANING_ACTION.USE_TOOL;
        meaning.extracted = { stageId };
        meaning.userMeaning = `user wants to inspect stage ${stageId}`;
        return meaning;
      }

      meaning.intent = "project_message";
      meaning.enoughInformation = true;
      meaning.suggestedAction = MEANING_ACTION.ANSWER;
      meaning.userMeaning = "project-related message";
      return meaning;
    }

    meaning.intent = "general_chat";
    meaning.enoughInformation = true;
    meaning.suggestedAction = MEANING_ACTION.ANSWER;
    meaning.userMeaning = "general user message";

    return meaning;
  }
}

export function understandMeaning(input = {}) {
  return new MeaningEngine().understand(input);
}

export default {
  MeaningEngine,
  understandMeaning,
};
