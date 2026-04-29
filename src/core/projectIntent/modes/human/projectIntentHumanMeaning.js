// src/core/projectIntent/modes/human/projectIntentHumanMeaning.js
// ============================================================================
// HUMAN MODE MEANING SKELETON
//
// Purpose:
// - meaning classification boundary for natural SG project/repo requests.
// - must not become a phrase router.
// - must not import Technical Mode legacy heuristics.
//
// Current status:
// - safe contract only.
// - not wired into runtime.
// - accepts structured meaning from context when provided.
// - can use an explicitly injected meaning provider only when explicitly allowed.
// - does not classify raw text by keywords/regex.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";

export const HUMAN_PROJECT_INTENT_KINDS = Object.freeze({
  REPO_STATUS_QUESTION: "repo_status_question",
  ARCHITECTURE_QUESTION: "architecture_question",
  MODULE_QUESTION: "module_question",
  RISK_QUESTION: "risk_question",
  NEXT_STEP_QUESTION: "next_step_question",
  FILE_OR_AREA_QUESTION: "file_or_area_question",
  UNKNOWN: "unknown",
});

function isKnownHumanProjectIntentKind(intentKind) {
  return Object.values(HUMAN_PROJECT_INTENT_KINDS).includes(intentKind);
}

function normalizeHumanProjectIntentMeaning(value = null) {
  const intentKind = value?.intentKind;

  if (!isKnownHumanProjectIntentKind(intentKind)) {
    return null;
  }

  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    intentKind,
    confidence: value?.confidence || "structured",
    reason: value?.reason || "human_meaning_loaded_from_context",
  };
}

async function runInjectedHumanMeaningProvider({ text = "", context = null } = {}) {
  const provider = context?.humanProjectIntentMeaningProvider || context?.humanMeaningProvider;

  if (typeof provider !== "function") {
    return null;
  }

  if (context?.allowHumanMeaningProviderRun !== true) {
    return {
      mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
      intentKind: HUMAN_PROJECT_INTENT_KINDS.UNKNOWN,
      confidence: "none",
      reason: "human_meaning_provider_present_but_not_allowed",
    };
  }

  const providedMeaning = await provider({
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    text,
    context,
  });

  return normalizeHumanProjectIntentMeaning(providedMeaning) || {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    intentKind: HUMAN_PROJECT_INTENT_KINDS.UNKNOWN,
    confidence: "none",
    reason: "human_meaning_provider_returned_invalid_meaning",
  };
}

export async function classifyHumanProjectIntentMeaning({ text = "", context = null } = {}) {
  const structuredMeaning = normalizeHumanProjectIntentMeaning(
    context?.humanProjectIntentMeaning || context?.humanMeaning || null
  );

  if (structuredMeaning) {
    return structuredMeaning;
  }

  const injectedProviderMeaning = await runInjectedHumanMeaningProvider({ text, context });

  if (injectedProviderMeaning) {
    return injectedProviderMeaning;
  }

  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    intentKind: HUMAN_PROJECT_INTENT_KINDS.UNKNOWN,
    confidence: "none",
    reason: "human_meaning_not_implemented",
  };
}

export default {
  HUMAN_PROJECT_INTENT_KINDS,
  classifyHumanProjectIntentMeaning,
};
