// src/core/projectIntent/modes/human/projectIntentHumanEntry.js
// ============================================================================
// HUMAN MODE ENTRY SKELETON
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";
import { checkHumanProjectIntentPermissions } from "./projectIntentHumanPermissions.js";
import { resolveHumanProjectFollowUp } from "./projectIntentHumanFollowUpResolver.js";
import { classifyHumanProjectIntentMeaning } from "./projectIntentHumanMeaning.js";
import { loadHumanProjectRepoFacts } from "./projectIntentHumanRepoFacts.js";
import { buildHumanProjectContextPack } from "./projectIntentHumanContextPackBuilder.js";
import { loadHumanProjectOfficialArchitecture } from "./projectIntentHumanOfficialArchitectureLoader.js";
import { selectHumanProjectCapability } from "./projectIntentHumanCapabilitySelector.js";
import { buildHumanProjectIntentResponse } from "./projectIntentHumanResponseBuilder.js";
import { buildHumanProjectDecisionTrace } from "./projectIntentHumanDecisionTraceBuilder.js";

export async function handleHumanProjectIntent({
  text = "",
  isMonarchUser = false,
  isPrivateChat = false,
  context = null,
} = {}) {
  const permissions = checkHumanProjectIntentPermissions({
    isMonarchUser,
    isPrivateChat,
    context,
  });

  if (!permissions.allowed) {
    return {
      mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
      handled: false,
      allowed: false,
      blocked: true,
      reason: permissions.reason,
      permissions,
    };
  }

  const followUp = resolveHumanProjectFollowUp({
    context,
    previousDecisionTrace: context?.previousHumanProjectDecisionTrace || null,
  });

  const meaning = await classifyHumanProjectIntentMeaning({ text, context });
  const repoFacts = await loadHumanProjectRepoFacts({ text, context, meaning });

  const officialArchitecture = await loadHumanProjectOfficialArchitecture();

  const contextWithOfficialArchitecture = {
    ...context,
    officialArchitecture,
  };

  const contextPack = buildHumanProjectContextPack({
    context: contextWithOfficialArchitecture,
    repoFacts,
    meaning,
  });

  const capability = selectHumanProjectCapability({
    text,
    context: contextWithOfficialArchitecture,
    meaning,
    repoFacts,
    contextPack,
  });

  const response = buildHumanProjectIntentResponse({
    text,
    context: contextWithOfficialArchitecture,
    permissions,
    meaning,
    repoFacts,
    capability,
    contextPack,
  });

  const decisionTrace = buildHumanProjectDecisionTrace({
    contextPack,
    meaning,
    capability,
    repoFacts,
    response,
  });

  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    handled: response.ok === true,
    allowed: true,
    blocked: false,
    reason: response.reason,
    permissions,
    followUp,
    meaning,
    repoFacts,
    contextPack,
    capability,
    response,
    decisionTrace,
  };
}

export default {
  handleHumanProjectIntent,
};
