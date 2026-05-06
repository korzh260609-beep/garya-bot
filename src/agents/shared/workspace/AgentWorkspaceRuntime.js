// AGENT NOTE:
// Agent workspace runtime hook skeleton.
// Purpose: provide a safe runtime boundary for workspace command reading and future execution.
// Do not write GitHub, call AI, call DB, modify Telegram flow, or execute commands here yet.

import { agentWorkspaceCommandReader } from "./AgentWorkspaceCommandReader.js";

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
    mode: normalizeString(process.env.AGENT_WORKSPACE_RUNTIME_MODE || "read_only_command_reader") || "read_only_command_reader",
  };
}

export function getAgentWorkspaceRuntimeStatus() {
  const config = getAgentWorkspaceRuntimeConfig();

  return {
    enabled: config.enabled,
    intervalMs: config.intervalMs,
    mode: config.mode,
    connected: config.enabled,
    githubReads: config.enabled,
    githubWrites: false,
    commandExecution: false,
  };
}

export function startAgentWorkspaceRuntime({
  logger = console,
  commandReader = agentWorkspaceCommandReader,
} = {}) {
  const config = getAgentWorkspaceRuntimeConfig();
  const status = getAgentWorkspaceRuntimeStatus();
  let timer = null;

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

  const tick = async () => {
    const result = await commandReader.readParsedCommand();

    if (!result.ok) {
      logger.log(`Agent workspace command read skipped/failed: ${result.reason}`);
      return result;
    }

    logger.log(`Agent workspace command read: ${result.command?.commandId || "NONE"} / ${result.command?.status || "EMPTY"}`);
    return result;
  };

  timer = setInterval(() => {
    tick().catch((error) => {
      logger.log(`Agent workspace command reader failed: ${error?.message || error}`);
    });
  }, config.intervalMs);

  tick().catch((error) => {
    logger.log(`Agent workspace command reader failed: ${error?.message || error}`);
  });

  return {
    ok: true,
    started: true,
    reason: "agent_workspace_runtime_read_only_reader_started",
    status,
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }

      return {
        ok: true,
        stopped: true,
        reason: "agent_workspace_runtime_stopped",
      };
    },
  };
}

export default {
  getAgentWorkspaceRuntimeConfig,
  getAgentWorkspaceRuntimeStatus,
  startAgentWorkspaceRuntime,
};
