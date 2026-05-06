// AGENT NOTE:
// Agent workspace runtime hook skeleton.
// Purpose: provide a safe runtime boundary for future workspace command execution.
// Do not read GitHub, write GitHub, call AI, call DB, modify Telegram flow, or execute commands here yet.

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function envBool(name, fallback = false) {
  const raw = normalizeString(process.env[name] || "").toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(raw);
}

function envInt(name, fallback, min, max) {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function getAgentWorkspaceRuntimeConfig() {
  return {
    enabled: envBool("AGENT_WORKSPACE_RUNTIME_ENABLED", false),
    intervalMs: envInt("AGENT_WORKSPACE_RUNTIME_INTERVAL_MS", 60000, 10000, 3600000),
    mode: normalizeString(process.env.AGENT_WORKSPACE_RUNTIME_MODE || "skeleton") || "skeleton",
  };
}

export function getAgentWorkspaceRuntimeStatus() {
  const config = getAgentWorkspaceRuntimeConfig();

  return {
    enabled: config.enabled,
    intervalMs: config.intervalMs,
    mode: config.mode,
    connected: false,
    githubReads: false,
    githubWrites: false,
    commandExecution: false,
  };
}

export function startAgentWorkspaceRuntime({ logger = console } = {}) {
  const config = getAgentWorkspaceRuntimeConfig();
  const status = getAgentWorkspaceRuntimeStatus();

  if (!config.enabled) {
    logger.log("Agent workspace runtime hook is disabled.");

    return {
      ok: true,
      started: false,
      reason: "agent_workspace_runtime_disabled",
      status,
      stop() {
        return {
          ok: true,
          stopped: false,
          reason: "agent_workspace_runtime_was_not_started",
        };
      },
    };
  }

  logger.log("Agent workspace runtime hook skeleton is enabled, but command I/O is not connected yet.");

  return {
    ok: true,
    started: false,
    reason: "agent_workspace_runtime_skeleton_not_connected",
    status,
    stop() {
      return {
        ok: true,
        stopped: false,
        reason: "agent_workspace_runtime_skeleton_not_started",
      };
    },
  };
}

export default {
  getAgentWorkspaceRuntimeConfig,
  getAgentWorkspaceRuntimeStatus,
  startAgentWorkspaceRuntime,
};
