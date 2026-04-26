// src/agentWorkspace/AgentWorkspaceCommandParser.js
// ============================================================================
// Parses agent_workspace/COMMANDS.md key/value command blocks.
// ============================================================================

const COMMAND_MARKDOWN_ALLOWED_ACTIONS = Object.freeze([
  "VERIFY_DEPLOY",
  "COLLECT_RENDER_REPORT",
  "COLLECT_RENDER_LOGS",
  "COLLECT_RENDER_DEPLOYS",
  "COLLECT_RENDER_DEPLOY",
  "COLLECT_RENDER_STATUS",
  "WRITE_TEST_NOTE",
  "RUN_DIAGNOSTIC_COMMANDS",
]);

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stripBackticks(value) {
  return normalizeString(value).replace(/^`+/, "").replace(/`+$/, "").trim();
}

function readField(text, field) {
  const re = new RegExp(`^${field}:\\s*(.+?)\\s*$`, "mi");
  const m = String(text || "").match(re);
  if (!m) return "";
  return stripBackticks(m[1]);
}

function readPayload(text) {
  const marker = "## Payload";
  const raw = String(text || "");
  const idx = raw.indexOf(marker);
  if (idx < 0) return "";
  const rest = raw.slice(idx + marker.length);
  const next = rest.indexOf("\n---");
  const payload = next >= 0 ? rest.slice(0, next) : rest;
  return payload.trim().replace(/^-\s*$/m, "").trim();
}

function buildAllowedActionsMarkdown() {
  return COMMAND_MARKDOWN_ALLOWED_ACTIONS.map((action) => `- \`${action}\``).join("\n");
}

export function parseAgentWorkspaceCommand(markdown = "") {
  const commandId = readField(markdown, "COMMAND_ID");
  const status = readField(markdown, "STATUS").toUpperCase();
  const action = readField(markdown, "ACTION").toUpperCase();
  const taskId = readField(markdown, "TASK_ID");
  const workflowPoint = readField(markdown, "WORKFLOW_POINT");
  const deployId = readField(markdown, "DEPLOY_ID");
  const requiresCommit = readField(markdown, "REQUIRES_COMMIT");
  const createdBy = readField(markdown, "CREATED_BY");
  const createdAt = readField(markdown, "CREATED_AT");
  const updatedAt = readField(markdown, "UPDATED_AT");
  const payload = readPayload(markdown);

  return {
    commandId: commandId || "NONE",
    status: status || "EMPTY",
    action: action || "NONE",
    taskId: taskId || "manual",
    workflowPoint: workflowPoint || "-",
    deployId: deployId === "-" ? "" : deployId,
    requiresCommit: requiresCommit === "-" ? "" : requiresCommit,
    createdBy: createdBy || "-",
    createdAt: createdAt || "-",
    updatedAt: updatedAt || "-",
    payload,
  };
}

export function buildAgentWorkspaceCommandMarkdown(command, status, resultText = "") {
  const now = new Date().toISOString();
  return `# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: \`${command.commandId || "NONE"}\`
STATUS: \`${status || command.status || "EMPTY"}\`
ACTION: \`${command.action || "NONE"}\`
TASK_ID: \`${command.taskId || "-"}\`
WORKFLOW_POINT: \`${command.workflowPoint || "-"}\`
DEPLOY_ID: \`${command.deployId || "-"}\`
REQUIRES_COMMIT: \`${command.requiresCommit || "-"}\`
CREATED_BY: \`${command.createdBy || "-"}\`
CREATED_AT: \`${command.createdAt || "-"}\`
UPDATED_AT: \`${now}\`

---

## Payload

${command.payload || "-"}

---

## Last result

${resultText || "-"}

---

## Allowed statuses

- \`EMPTY\`
- \`PENDING\`
- \`RUNNING\`
- \`DONE\`
- \`FAILED\`
- \`IGNORED\`

## Allowed actions

${buildAllowedActionsMarkdown()}

## Hard limits

- SG runs only \`STATUS: PENDING\` commands.
- SG ignores already completed commands.
- SG never writes code or pillars from this command file.
- SG updates only allowlisted files in \`agent_workspace/\`.
- If \`REQUIRES_COMMIT\` is set, SG must skip execution until runtime commit matches it.
`;
}

export default {
  parseAgentWorkspaceCommand,
  buildAgentWorkspaceCommandMarkdown,
};
