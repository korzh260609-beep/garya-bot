// src/core/projectIntent/modes/human/projectIntentHumanContext.js
// ============================================================================
// HUMAN MODE CONTEXT CONTRACT
//
// Purpose:
// - controlled context container for future Human Mode project/repo work.
// - keeps meaning provider and RepoStateAgent runner gates explicit.
// - must not connect Human Mode to runtime by itself.
// - must not classify raw text, call providers, or run RepoStateAgent.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";

export function buildHumanProjectIntentContext({
  humanProjectIntentMeaning = null,
  humanMeaning = null,
  humanProjectIntentMeaningProvider = null,
  humanMeaningProvider = null,
  repoStateAgentResult = null,
  repoStateAgentRunner = null,
  allowHumanMeaningProviderRun = false,
  allowHumanRepoStateAgentRun = false,
  metadata = null,
} = {}) {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    humanProjectIntentMeaning,
    humanMeaning,
    humanProjectIntentMeaningProvider,
    humanMeaningProvider,
    repoStateAgentResult,
    repoStateAgentRunner,
    allowHumanMeaningProviderRun: allowHumanMeaningProviderRun === true,
    allowHumanRepoStateAgentRun: allowHumanRepoStateAgentRun === true,
    metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata
      : null,
  };
}

export function hasHumanMeaningExecutionPermission(context = null) {
  return context?.mode === PROJECT_INTENT_INTERFACE_MODES.HUMAN &&
    context?.allowHumanMeaningProviderRun === true;
}

export function hasHumanRepoStateAgentExecutionPermission(context = null) {
  return context?.mode === PROJECT_INTENT_INTERFACE_MODES.HUMAN &&
    context?.allowHumanRepoStateAgentRun === true;
}

export default {
  buildHumanProjectIntentContext,
  hasHumanMeaningExecutionPermission,
  hasHumanRepoStateAgentExecutionPermission,
};
