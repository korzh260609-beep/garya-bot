// src/core/meaning/MeaningEngine.js
// ============================================================================
// CORE MEANING — Meaning Engine (SKELETON / DRY-RUN)
// Purpose:
// - central place to interpret user intent by meaning (not phrases)
// - decide if enough information is available
// - suggest next action (answer / clarify / plan / use_tool)
// IMPORTANT:
// - NO DB writes
// - NO external calls (GitHub, APIs)
// - NO hardcoded replies
// - Returns structured meaning only
// ============================================================================

import { createEmptyMeaning, MEANING_ACTION, MEANING_DOMAIN, MEANING_CONFIDENCE } from "./MeaningTypes.js";

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

function inferIntentProject({ text = "" } = {}) {
  const s = safeText(text).toLowerCase();
  const wantsInspect = /(проверь|проверить|статус|готов|заверш|check|status)/i.test(s);
  const stageIdMatch = safeText(text).match(/(?:stage|этап)\s*([0-9]+[a-zа-я]?(?:\.[0-9]+)?)/i);
  const stageId = stageIdMatch ? stageIdMatch[1].toUpperCase() : null;

  if (wantsInspect) {
    return {
      intent: "inspect_project_stage",
      extracted: { stageId },
    };
  }

  return {
    intent: "project_message",
    extracted: {},
  };
}

export class MeaningEngine {
  understand({ text = "", hasActiveProjectSession = false } = {}) {
    const meaning = createEmptyMeaning({ source: "MeaningEngine" });
    const domain = detectDomain({ text, hasActiveProjectSession });

    meaning.domain = domain;
    meaning.confidence = MEANING_CONFIDENCE.MEDIUM;
    meaning.confidenceScore = 0.6;

    if (domain === MEANING_DOMAIN.PROJECT) {
      const { intent, extracted } = inferIntentProject({ text });
      meaning.intent = intent;
      meaning.extracted = extracted;

      if (intent === "inspect_project_stage") {
        if (!extracted?.stageId) {
          meaning.enoughInformation = false;
          meaning.missingInformation = ["stage_id"];
          meaning.suggestedAction = MEANING_ACTION.CLARIFY;
          meaning.userMeaning = "user wants to inspect a project stage but did not specify which stage";
        } else {
          meaning.enoughInformation = true;
          meaning.suggestedAction = MEANING_ACTION.USE_TOOL;
          meaning.userMeaning = `user wants to inspect project stage ${extracted.stageId}`;
          meaning.toolHints = ["project_stage_inspection"];
        }
      } else {
        meaning.enoughInformation = true;
        meaning.suggestedAction = MEANING_ACTION.ANSWER;
        meaning.userMeaning = "project-related message";
      }

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
