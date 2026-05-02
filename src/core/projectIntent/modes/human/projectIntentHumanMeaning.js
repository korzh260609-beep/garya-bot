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
// - accepts structured meaning from context when provided.
// - can derive broad project intent from core structured meaning.
// - can use an explicitly injected meaning provider only when explicitly allowed.
// - avoids old command/phrase routing.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";

export const HUMAN_PROJECT_INTENT_KINDS = Object.freeze({
  REPO_STATUS_QUESTION: "repo_status_question",
  ARCHITECTURE_QUESTION: "architecture_question",
  MODULE_QUESTION: "module_question",
  RISK_QUESTION: "risk_question",
  NEXT_STEP_QUESTION: "next_step_question",
  FILE_OR_AREA_QUESTION: "file_or_area_question",
  SOURCE_QUESTION: "source_question",
  PROJECT_ANALYSIS: "project_analysis",
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

function deriveIntentFromCoreMeaning(context = null) {
  const coreMeaning = context?.coreMeaning || null;
  const text = String(context?.text || context?.rawText || "").trim().toLowerCase();
  const userMeaning = String(coreMeaning?.userMeaning || "").toLowerCase();
  const combined = `${text} ${userMeaning}`;

  if (!coreMeaning || typeof coreMeaning !== "object") {
    return null;
  }

  const isProjectContext =
    coreMeaning.domain === "project" ||
    coreMeaning.intent === "project_message" ||
    coreMeaning.intent === "inspect_project_stage" ||
    context?.projectContextAllowed === true ||
    context?.projectContextDecision?.depth === "deep" ||
    context?.projectContextDecision?.depth === "light";

  const asksRepo = combined.includes("repo") || combined.includes("репозитор") || combined.includes("github");
  const asksArchitecture = combined.includes("architecture") || combined.includes("архитектур");
  const asksRisk = combined.includes("risk") || combined.includes("риск") || combined.includes("опасн");
  const asksNext = combined.includes("next") || combined.includes("дальше") || combined.includes("следующ");
  const asksModule = combined.includes("module") || combined.includes("модул");

  if (asksArchitecture) {
    return {
      mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
      intentKind: HUMAN_PROJECT_INTENT_KINDS.ARCHITECTURE_QUESTION,
      confidence: isProjectContext ? "medium" : "low",
      reason: "derived_from_core_meaning_architecture_focus",
    };
  }

  if (asksRisk) {
    return {
      mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
      intentKind: HUMAN_PROJECT_INTENT_KINDS.RISK_QUESTION,
      confidence: isProjectContext ? "medium" : "low",
      reason: "derived_from_core_meaning_risk_focus",
    };
  }

  if (asksNext) {
    return {
      mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
      intentKind: HUMAN_PROJECT_INTENT_KINDS.NEXT_STEP_QUESTION,
      confidence: isProjectContext ? "medium" : "low",
      reason: "derived_from_core_meaning_next_step_focus",
    };
  }

  if (asksModule) {
    return {
      mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
      intentKind: HUMAN_PROJECT_INTENT_KINDS.MODULE_QUESTION,
      confidence: isProjectContext ? "medium" : "low",
      reason: "derived_from_core_meaning_module_focus",
    };
  }

  if (isProjectContext || asksRepo) {
    return {
      mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
      intentKind: HUMAN_PROJECT_INTENT_KINDS.PROJECT_ANALYSIS,
      confidence: isProjectContext ? "medium" : "low",
      reason: "derived_from_core_meaning_project_analysis",
    };
  }

  return null;
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

  const derivedMeaning = deriveIntentFromCoreMeaning({
    ...context,
    text,
  });

  if (derivedMeaning) {
    return derivedMeaning;
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
