// src/core/projectIntent/modes/human/projectIntentHumanResponseBuilder.js
// ============================================================================
// HUMAN MODE RESPONSE BUILDER SKELETON
//
// Purpose:
// - human-readable response builder boundary for Human Mode repo/project work.
// - must not expose debug protocol unless explicitly requested.
// - must not use old Technical Mode template replies as Human Mode intelligence.
//
// Current status:
// - safe contract only.
// - not wired into runtime.
// - builds only minimal safe responses from structured repoFacts + capability.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";
import { HUMAN_PROJECT_CAPABILITIES } from "./projectIntentHumanCapabilitySelector.js";

function readRepoLabel(repoFacts = {}) {
  const repo = repoFacts?.facts?.repo || {};
  const fullName = repo.fullName || "unknown repo";
  const branch = repo.branch || "unknown branch";

  return `${fullName} / ${branch}`;
}

function readTotals(repoFacts = {}) {
  const totals = repoFacts?.facts?.totals || {};

  return {
    files: Number.isFinite(totals.files) ? totals.files : 0,
    modules: Number.isFinite(totals.modules) ? totals.modules : 0,
    dependencies: Number.isFinite(totals.dependencies) ? totals.dependencies : 0,
  };
}

function buildResponseTextForCapability({ capability, repoFacts }) {
  const repoLabel = readRepoLabel(repoFacts);
  const totals = readTotals(repoFacts);
  const architectureHealth = repoFacts?.facts?.architectureHealth || null;
  const nextActionPlan = repoFacts?.facts?.nextActionPlan || null;

  switch (capability) {
    case HUMAN_PROJECT_CAPABILITIES.ANSWER_FROM_REPO_STATE:
      return `Repo facts loaded from RepoStateAgent for ${repoLabel}. Files: ${totals.files}. Modules: ${totals.modules}. Dependencies: ${totals.dependencies}.`;

    case HUMAN_PROJECT_CAPABILITIES.SUMMARIZE_ARCHITECTURE:
      return architectureHealth?.summary
        ? `Architecture summary for ${repoLabel}: ${architectureHealth.summary}`
        : `Architecture facts loaded from RepoStateAgent for ${repoLabel}. Files: ${totals.files}. Modules: ${totals.modules}. Dependencies: ${totals.dependencies}.`;

    case HUMAN_PROJECT_CAPABILITIES.IDENTIFY_RISK:
      return architectureHealth?.riskSummary
        ? `Risk summary for ${repoLabel}: ${architectureHealth.riskSummary}`
        : `Risk facts are not detailed yet. RepoStateAgent facts are available for ${repoLabel}.`;

    case HUMAN_PROJECT_CAPABILITIES.SUGGEST_NEXT_STEP:
      return nextActionPlan?.summary
        ? `Next step for ${repoLabel}: ${nextActionPlan.summary}`
        : `Next-step facts are not detailed yet. RepoStateAgent facts are available for ${repoLabel}.`;

    case HUMAN_PROJECT_CAPABILITIES.EXPLAIN_MODULE:
      return `Module explanation needs a selected module or area. RepoStateAgent facts are available for ${repoLabel}.`;

    case HUMAN_PROJECT_CAPABILITIES.ASK_CLARIFICATION:
      return "I need a clearer project area or question before selecting a Human Mode capability.";

    case HUMAN_PROJECT_CAPABILITIES.NONE:
    default:
      return "Human Mode capability is not ready to build a project response.";
  }
}

export function buildHumanProjectIntentResponse({ repoFacts, capability } = {}) {
  if (repoFacts?.ok !== true) {
    return {
      mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
      ok: false,
      text: "Human Mode needs RepoStateAgent facts before building a project response.",
      reason: "repo_facts_required_before_response",
    };
  }

  if (capability?.ready !== true) {
    return {
      mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
      ok: false,
      text: "Human Mode capability is not ready yet.",
      reason: "capability_required_before_response",
    };
  }

  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    ok: true,
    text: buildResponseTextForCapability({
      capability: capability.capability,
      repoFacts,
    }),
    reason: "human_response_built_from_repo_facts_and_capability",
  };
}

export default {
  buildHumanProjectIntentResponse,
};
