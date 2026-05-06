// AGENT NOTE:
// Agent workspace command parser skeleton.
// Purpose: parse agent_workspace/COMMANDS.md key/value commands for future runtime runner.
// This parser does not execute commands and does not perform reads/writes.

export const AGENT_WORKSPACE_ALLOWED_ACTIONS = Object.freeze([
  "COLLECT_RENDER_ENV_STATUS",
  "COLLECT_RENDER_LOGS",
  "COLLECT_RENDER_DEPLOYS",
  "COLLECT_RENDER_DEPLOY",
  "COLLECT_RENDER_STATUS",
]);

export const AGENT_WORKSPACE_ALLOWED_STATUSES = Object.freeze([
  "EMPTY",
  "PENDING",
  "RUNNING",
  "DONE",
  "FAILED",
  "IGNORED",
]);

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stripBackticks(value) {
  return normalizeString(value).replace(/^`+/, "").replace(/`+$/, "").trim();
}

function readField(text, field) {
  const re = new RegExp(`^${field}:\\s*(.+?)\\s*$`, "mi");
  const match = String(text || "").match(re);
  if (!match) return "";
  return stripBackticks(match[1]);
}

function readPayload(text) {
  const marker = "## Payload";
  const raw = String(text || "");
  const index = raw.indexOf(marker);
  if (index < 0) return "";

  const rest = raw.slice(index + marker.length);
  const nextSection = rest.indexOf("\n---");
  const payload = nextSection >= 0 ? rest.slice(0, nextSection) : rest;

  return payload.trim().replace(/^-\s*$/m, "").trim();
}

export function parseAgentWorkspaceCommand(markdown = "") {
  const commandId = readField(markdown, "COMMAND_ID") || "NONE";
  const status = (readField(markdown, "STATUS") || "EMPTY").toUpperCase();
  const action = (readField(markdown, "ACTION") || "NONE").toUpperCase();
  const taskId = readField(markdown, "TASK_ID") || "manual";
  const workflowPoint = readField(markdown, "WORKFLOW_POINT") || "-";
  const deployId = readField(markdown, "DEPLOY_ID");
  const requiresCommit = readField(markdown, "REQUIRES_COMMIT");

  return {
    commandId,
    status,
    action,
    taskId,
    workflowPoint,
    deployId: deployId === "-" ? "" : deployId,
    requiresCommit: requiresCommit === "-" ? "" : requiresCommit,
    createdBy: readField(markdown, "CREATED_BY") || "-",
    createdAt: readField(markdown, "CREATED_AT") || "-",
    updatedAt: readField(markdown, "UPDATED_AT") || "-",
    payload: readPayload(markdown),
    isPending: status === "PENDING",
    isAllowedAction: AGENT_WORKSPACE_ALLOWED_ACTIONS.includes(action),
    isAllowedStatus: AGENT_WORKSPACE_ALLOWED_STATUSES.includes(status),
  };
}

export default {
  AGENT_WORKSPACE_ALLOWED_ACTIONS,
  AGENT_WORKSPACE_ALLOWED_STATUSES,
  parseAgentWorkspaceCommand,
};
