// src/core/projectIntent/modes/human/projectIntentHumanDecisionTraceBuilder.js
// ============================================================================
// HUMAN PROJECT DECISION TRACE BUILDER — SKELETON
//
// Purpose:
// - build a safe audit trace for Human Mode project/repo answers.
// - describe the runtime decision path from already-structured data.
// - prepare future follow-up handling without keyword/phrase routing.
//
// Hard rules:
// - no keyword matching.
// - no phrase matching.
// - no regex routing.
// - no raw user text interpretation.
// - no DB writes.
// - no AI calls.
// - no repo scans.
// - no final response generation here.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";

function readRepoFactsSourceProof(repoFacts = null) {
  const sourceProof = repoFacts?.sourceProof || null;

  if (!sourceProof || typeof sourceProof !== "object" || Array.isArray(sourceProof)) {
    return {
      available: false,
      verified: false,
      source: repoFacts?.source || null,
      canClaimVerifiedFacts: false,
      canAuthorizeWrite: false,
      canExecute: false,
      reason: "repo_facts_source_proof_missing",
    };
  }

  return {
    available: true,
    verified: sourceProof.verified === true,
    source: sourceProof.source || repoFacts?.source || null,
    canClaimVerifiedFacts: sourceProof.canClaimVerifiedFacts === true,
    canAuthorizeWrite: sourceProof.canAuthorizeWrite === true,
    canExecute: sourceProof.canExecute === true,
    reason: sourceProof.reason || null,
  };
}

function readRepoFactsSummary(repoFacts = null) {
  const facts = repoFacts?.facts || {};
  const totals = facts?.totals || {};
  const health = facts?.architectureHealth || {};

  return {
    available: repoFacts?.ok === true,
    source: repoFacts?.source || null,
    sourceProof: readRepoFactsSourceProof(repoFacts),
    repo: facts?.repo || null,
    files: Number.isFinite(totals?.files) ? totals.files : null,
    modules: Number.isFinite(totals?.modules) ? totals.modules : null,
    dependencies: Number.isFinite(totals?.dependencies) ? totals.dependencies : null,
    architectureStatus: health?.status || null,
    architectureScore: Number.isFinite(health?.score) ? health.score : null,
  };
}

function readSourcesSummary(contextPack = null) {
  return {
    repoFacts: {
      available: contextPack?.repoFacts?.available === true,
      source: contextPack?.repoFacts?.source || null,
    },
    officialArchitecture: {
      available: contextPack?.officialArchitecture?.available === true,
      source: contextPack?.officialArchitecture?.source || null,
    },
    projectMemory: {
      available: contextPack?.projectMemory?.available === true,
      source: contextPack?.projectMemory?.source || null,
    },
    userRules: {
      available: contextPack?.userRules?.available === true,
      source: contextPack?.userRules?.source || null,
    },
  };
}

export function buildHumanProjectDecisionTrace({
  contextPack = null,
  meaning = null,
  capability = null,
  repoFacts = null,
  response = null,
} = {}) {
  return {
    ok: true,
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    source: "human_project_decision_trace_v1",
    activeProject: contextPack?.activeProject || null,
    meaning: {
      intentKind: meaning?.intentKind || null,
      confidence: meaning?.confidence || null,
      reason: meaning?.reason || null,
    },
    capability: {
      selected: capability?.capability || null,
      ready: capability?.ready === true,
      reason: capability?.reason || null,
    },
    sources: readSourcesSummary(contextPack),
    repoFactsSummary: readRepoFactsSummary(repoFacts),
    response: {
      ok: response?.ok === true,
      mode: response?.mode || null,
      reason: response?.reason || null,
      hasText: typeof response?.text === "string" && response.text.trim().length > 0,
    },
    tokens: {
      realAiSpent: false,
      source: "trace_builder_no_ai",
    },
    policy: {
      builtFromStructuredRuntimeDataOnly: true,
      noKeywordMatching: true,
      noPhraseMatching: true,
      noRawTextInterpretation: true,
      noSourceMaySilentlyOverrideAnother: true,
      sourceProofCannotAuthorizeWrites: true,
      sourceProofCannotExecuteActions: true,
    },
  };
}

export default {
  buildHumanProjectDecisionTrace,
};
