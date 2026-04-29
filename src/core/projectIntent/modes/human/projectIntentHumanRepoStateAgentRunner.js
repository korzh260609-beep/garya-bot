// src/core/projectIntent/modes/human/projectIntentHumanRepoStateAgentRunner.js
// ============================================================================
// HUMAN MODE REPOSTATEAGENT RUNNER ADAPTER
//
// Purpose:
// - isolated adapter for future Human Mode RepoStateAgent execution.
// - keeps real RepoStateAgent execution behind explicit caller control.
// - must not connect Human Mode to runtime by itself.
// - must not use old RepoIndex / old hardcoded maps / legacy Technical Mode.
//
// Current status:
// - safe adapter contract only.
// - not wired into runtime.
// - no work is executed unless the returned runner is explicitly called.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";
import RepoStateAgentService from "../../../../simpleAgents/repoStateAgent/RepoStateAgentService.js";

export function createHumanRepoStateAgentRunner({
  RepoStateAgentServiceClass = RepoStateAgentService,
  defaultOptions = null,
} = {}) {
  return async function humanRepoStateAgentRunner(runnerContext = {}) {
    if (runnerContext?.mode !== PROJECT_INTENT_INTERFACE_MODES.HUMAN) {
      return {
        ok: false,
        reason: "human_repo_state_agent_runner_requires_human_mode",
      };
    }

    const service = new RepoStateAgentServiceClass();
    const options = {
      ...(defaultOptions || {}),
      ...(runnerContext?.options || {}),
    };

    return service.run(options);
  };
}

export default {
  createHumanRepoStateAgentRunner,
};
