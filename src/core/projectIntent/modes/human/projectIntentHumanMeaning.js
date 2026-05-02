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
// - can derive broad project intent only from structured core/project context.
// - can use an explicitly injected meaning provider only when explicitly allowed.
// - avoids old command/phrase/keyword/regex routing.
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

const HUMAN_PROJECT_INTENT_KIND_SET = new Set(Object.values(HUMAN_PROJECT_INTENT_KINDS));

function isKnownHumanProjectIntentKind(intentKind) {
  return HUMAN_PROJECT_INTENT_KIND_SET.has(intentKind);
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
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

function readStructuredIntentKind(...values) {
  for (const value of values) {
    if (isKnownHumanProjectIntentKind(value)) {
      return value;
    }
  }

  return null;
}

function readProjectContextSignal(context = null) {
  const projectContextDecision = asObject(context?.projectContextDecision);

  return (
    context?.projectContextAllowed === true ||
    projectContextDecision?.depth === "deep" ||
    projectContextDecision?.depth === "light"
  );
}

function deriveIntentFromCoreMeaning(context = null) {
  const coreMeaning = asObject(context?.coreMeaning);
  const projectContextDecision = asObject(context?.projectContextDecision);

  if (!coreMeaning) {
    return null;
  }

  const structuredIntentKind = readStructuredIntentKind(
    coreMeaning.humanProjectIntentKind,
    coreMeaning.projectIntentKind,
    coreMeaning.intentKind,
    projectContextDecision?.humanProjectIntentKind,
    projectContextDecision?.projectIntentKind,
    projectContextDecision?.intentKind
  );

  if (structuredIntentKind) {
    return {
      mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
      intentKind: structuredIntentKind,
      confidence: "medium",
      reason: "derived_from_structured_core_meaning_intent_kind",
    };
  }

  const isProjectContext =
    coreMeaning.domain === "project" ||
    coreMeaning.intent === "project_message" ||
    coreMeaning.intent === "inspect_project_stage" ||
    readProjectContextSignal(context);

  if (isProjectContext) {
    return {
      mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
      intentKind: HUMAN_PROJECT_INTENT_KINDS.PROJECT_ANALYSIS,
      confidence: "medium",
      reason: "derived_from_structured_core_meaning_project_context",
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

  const derivedMeaning = deriveIntentFromCoreMeaning(context);

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
