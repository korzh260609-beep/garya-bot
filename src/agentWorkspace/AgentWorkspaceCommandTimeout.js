// src/agentWorkspace/AgentWorkspaceCommandTimeout.js
// ============================================================================
// AgentWorkspace Command Timeout
// Prevents a workspace command from keeping COMMANDS.md in RUNNING forever.
// ============================================================================

const DEFAULT_AGENT_WORKSPACE_COMMAND_TIMEOUT_MS = 240000;

export function getAgentWorkspaceCommandTimeoutMs() {
  const raw = Number(process.env.AGENT_WORKSPACE_COMMAND_TIMEOUT_MS || 0);

  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }

  return DEFAULT_AGENT_WORKSPACE_COMMAND_TIMEOUT_MS;
}

export async function runWithAgentWorkspaceTimeout(promise, {
  timeoutMs = getAgentWorkspaceCommandTimeoutMs(),
  label = "agent_workspace_command",
} = {}) {
  let timeoutHandle = null;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${label}_timeout_after_${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      promise,
      timeoutPromise,
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export default {
  getAgentWorkspaceCommandTimeoutMs,
  runWithAgentWorkspaceTimeout,
};
