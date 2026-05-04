// AGENT NOTE:
// SG 2.0 workspace command parser skeleton.
// Purpose: parse explicit COMMANDS.md text into a safe, inert command object.
// Do not execute commands, call Render, write files, call AI, DB, GitHub, or Telegram here.

import {
  getWorkspaceReportTypeForAction,
  isWorkspaceCommandActionAllowed,
  WORKSPACE_COMMAND_ACTIONS,
} from "./WorkspaceReportTypes.js";

function parseKeyValueLines(content = "") {
  const fields = {};
  const lines = String(content || "").split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*:\s*(.*?)\s*$/);
    if (!match) continue;
    fields[match[1]] = match[2];
  }

  return fields;
}

function safeInt(value, fallback = null, min = 1, max = 1000) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function parseWorkspaceCommand(content = "") {
  const fields = parseKeyValueLines(content);
  const action = fields.ACTION || WORKSPACE_COMMAND_ACTIONS.none;
  const commandId = fields.COMMAND_ID || "NONE";
  const status = fields.STATUS || "EMPTY";
  const reportType = getWorkspaceReportTypeForAction(action);
  const warnings = [];

  if (!isWorkspaceCommandActionAllowed(action)) {
    warnings.push(`workspace_command_action_not_allowed:${action}`);
  }

  return {
    ok: warnings.length === 0,
    commandId,
    status,
    action,
    reportType,
    parameters: {
      deployId: fields.DEPLOY_ID || null,
      limit: safeInt(fields.LIMIT, null, 1, 1000),
      target: fields.TARGET || null,
    },
    canChangeState: false,
    tokensSpent: false,
    warnings,
    metadata: {
      mode: "workspace_command_parser_skeleton_v1",
      executesCommand: false,
      connectedToRuntime: false,
      connectedToAI: false,
      connectedToRender: false,
    },
  };
}

export default {
  parseWorkspaceCommand,
};
