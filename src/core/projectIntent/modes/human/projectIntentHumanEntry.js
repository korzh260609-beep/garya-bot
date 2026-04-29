// src/core/projectIntent/modes/human/projectIntentHumanEntry.js
// ============================================================================
// HUMAN MODE ENTRY SKELETON
//
// Purpose:
// - future entry point for natural SG project/repo requests.
// - keeps Human Mode separate from Technical Mode legacy routing.
// - must not use slash commands, exact phrases, keywords or regex routing.
// - must not use old RepoIndex / old snapshot outputs as current factual truth.
//
// Current status:
// - skeleton only.
// - not wired into runtime.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";
import { checkHumanProjectIntentPermissions } from "./projectIntentHumanPermissions.js";
import { classifyHumanProjectIntentMeaning } from "./projectIntentHumanMeaning.js";
import { loadHumanProjectRepoFacts } from "./projectIntentHumanRepoFacts.js";
import { buildHumanProjectContextPack } from "./projectIntentHumanContextPackBuilder.js";
import { selectHumanProjectCapability } from "./projectIntentHumanCapabilitySelector.js";
import { buildHumanProjectIntentResponse } from "./projectIntentHumanResponseBuilder.js";

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

  const meaning = await classifyHumanProjectIntentMeaning({ text, context });
  const repoFacts = await loadHumanProjectRepoFacts({ text, context, meaning });
  const contextPack = buildHumanProjectContextPack({
    context,
    repoFacts,
    meaning,
  });
  const capability = selectHumanProjectCapability({
    text,
    context,
    meaning,
    repoFacts,
    contextPack,
  });
  const response = buildHumanProjectIntentResponse({
    text,
    context,
    permissions,
    meaning,
    repoFacts,
    capability,
    contextPack,
  });

  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    handled: response.ok === true,
    allowed: true,
    blocked: false,
    reason: response.reason,
    permissions,
    meaning,
    repoFacts,
    contextPack,
    capability,
    response,
  };
}

export default {
  handleHumanProjectIntent,
};
