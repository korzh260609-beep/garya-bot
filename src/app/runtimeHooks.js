// AGENT NOTE:
// SG 2.0 runtime hooks boundary.
// Purpose: start optional runtime hooks without bloating index.js or app factory.
// Do not add routes, Telegram handlers, AI calls, DB calls, or GitHub writes here.

import { startAgentWorkspaceRuntime } from "../agents/shared/workspace/index.js";

export function startRuntimeHooks({ logger = console } = {}) {
  const agentWorkspaceRuntime = startAgentWorkspaceRuntime({ logger });

  return {
    ok: true,
    agentWorkspaceRuntime,
    stop() {
      if (typeof agentWorkspaceRuntime?.stop === "function") {
        return agentWorkspaceRuntime.stop();
      }

      return {
        ok: true,
        stopped: false,
        reason: "runtime_hooks_no_active_hooks",
      };
    },
  };
}

export default {
  startRuntimeHooks,
};
