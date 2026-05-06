// AGENT NOTE:
// Agent workspace runtime hook skeleton.
// Purpose: provide a safe runtime boundary for workspace command reading and gated future execution.
// Do not write GitHub, call AI, call DB, or modify Telegram flow here.

import { agentWorkspaceCommandReader } from "./AgentWorkspaceCommandReader.js";
import { agentWorkspaceCommandRunner } from "./AgentWorkspaceCommandRunner.js";

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

function buildExecutionDisabledResult(readResult = {}) {
  return {
    ok: true,
    skipped: true,
    reason: "agent_workspace_runtime_execution_disabled",
    commandId: readResult.command?.commandId || "NONE",
    status: readResult.command?.status || "EMPTY",
    action: readResult.command?.action || "NONE",
    githubReads: readResult.githubReads === true,
    githubWrites: false,
    commandExecution: false,
  };
}

export function getAgentWorkspaceRuntimeConfig() {
  return {
    enabled: envBool("AGENT_WORKSPACE_RUNTIME_ENABLED", false),
    executionEnabled: envBool("AGENT_WORKSPACE_RUNTIME_EXECUTION_ENABLED", false),
    intervalMs: envInt("AGENT_WORKSPACE_RUNTIME_INTERVAL_MS", 60000, 10000, 3600000),
    mode: normalizeString(process.env.AGENT_WORKSPACE_RUNTIME_MODE || "read_only_command_reader") || "read_only_command_reader",
  };
}

export function getAgentWorkspaceRuntimeStatus() {
  const config = getAgentWorkspaceRuntimeConfig();

  return {
    enabled: config.enabled,
    executionEnabled: config.executionEnabled,
    intervalMs: config.intervalMs,
    mode: config.mode,
    connected: config.enabled,
    githubReads: config.enabled,
    githubWrites: false,
    commandExecution: config.enabled && config.executionEnabled,
  };
}

export function startAgentWorkspaceRuntime({
  logger = console,
  commandReader = agentWorkspaceCommandReader,
  commandRunner = agentWorkspaceCommandRunner,
} = {}) {
  const config = getAgentWorkspaceRuntimeConfig();
  const status = getAgentWorkspaceRuntimeStatus();
  let timer = null;
  let running = false;

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
    if (running) {
      return {
        ok: true,
        skipped: true,
        reason: "agent_workspace_runtime_tick_already_running",
        githubReads: false,
        githubWrites: false,
        commandExecution: false,
      };
    }

    running = true;

    try {
      const readResult = await commandReader.readParsedCommand();

      if (!readResult.ok) {
        logger.log(`Agent workspace command read skipped/failed: ${readResult.reason}`);
        return readResult;
      }

      logger.log(`Agent workspace command read: ${readResult.command?.commandId || "NONE"} / ${readResult.command?.status || "EMPTY"}`);

      if (!config.executionEnabled) {
        return buildExecutionDisabledResult(readResult);
      }

      const executionResult = await commandRunner.executeParsedCommand(readResult.command);
      logger.log(`Agent workspace command execution result: ${executionResult.commandId || "NONE"} / ${executionResult.reason || executionResult.summary || "done"}`);

      return {
        ...executionResult,
        githubReads: true,
        githubWrites: false,
        commandExecution: true,
      };
    } finally {
      running = false;
    }
  };

  timer = setInterval(() => {
    tick().catch((error) => {
      logger.log(`Agent workspace runtime tick failed: ${error?.message || error}`);
    });
  }, config.intervalMs);

  tick().catch((error) => {
    logger.log(`Agent workspace runtime tick failed: ${error?.message || error}`);
  });

  return {
    ok: true,
    started: true,
    reason: config.executionEnabled
      ? "agent_workspace_runtime_executor_started"
      : "agent_workspace_runtime_read_only_reader_started",
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
