// AGENT NOTE:
// SG 2.0 Advisor Outbox Agent.
// Purpose: mirror a final SG reply into agent_workspace/OUTBOX.md for Advisor-side reading.
// Keep this agent simple: one responsibility, one allowlisted file, overwrite-only.
// Do not add Telegram handling, AI calls, DB calls, source fetching, or broad repository writes here.

import { executeGitHubApiRequest } from "../../tools/github/githubApiClient.js";
import {
  getCurrentProjectBranch,
  getCurrentProjectRepository,
} from "../../tools/github/githubProjectDefaults.js";

const OUTBOX_PATH = "agent_workspace/OUTBOX.md";
const MAX_TEXT_LENGTH = 12000;

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clampText(value) {
  const text = normalizeText(value);
  if (text.length <= MAX_TEXT_LENGTH) return text;
  return `${text.slice(0, MAX_TEXT_LENGTH)}\n\n[TRUNCATED: advisor outbox max length reached]`;
}

function encodeBase64Utf8(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64");
}

function buildContentPath(repo, path) {
  return `/repos/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function buildOutboxMarkdown({ commandText, replyText, source, taskId, updatedAt }) {
  return `# OUTBOX

State: READY
Mode: overwrite_latest
Updated at: ${updatedAt}
Updated by: advisor-outbox-agent
Source: ${source || "unknown"}
Task ID: ${taskId || "manual"}

---

## Command

${commandText || "-"}

---

## SG Reply

${replyText || "-"}
`;
}

async function readOutboxSha({ repo, branch }) {
  const result = await executeGitHubApiRequest({
    method: "GET",
    path: buildContentPath(repo, OUTBOX_PATH),
    query: { ref: branch },
  });

  if (!result.ok) {
    return null;
  }

  return result.data?.sha || null;
}

export async function runAdvisorOutboxAgent(input = {}, context = {}) {
  if (!context?.isMonarch) {
    return {
      ok: false,
      error: "advisor_outbox_not_allowed",
    };
  }

  const repo = normalizeText(input.repo) || getCurrentProjectRepository();
  const branch = normalizeText(input.branch) || getCurrentProjectBranch();
  const replyText = clampText(input.replyText || input.reply || input.text);
  const commandText = clampText(input.commandText || context.latestUserText || "");
  const source = normalizeText(input.source) || context.transport || "telegram";
  const taskId = normalizeText(input.taskId) || "manual";
  const updatedAt = new Date().toISOString();

  if (!replyText) {
    return {
      ok: false,
      error: "advisor_outbox_reply_missing",
    };
  }

  const sha = await readOutboxSha({ repo, branch });
  const content = buildOutboxMarkdown({
    commandText,
    replyText,
    source,
    taskId,
    updatedAt,
  });

  const result = await executeGitHubApiRequest({
    method: "PUT",
    path: buildContentPath(repo, OUTBOX_PATH),
    body: {
      message: "workspace: update advisor outbox",
      branch,
      content: encodeBase64Utf8(content),
      ...(sha ? { sha } : {}),
    },
  });

  return {
    ok: Boolean(result.ok),
    type: "advisor_outbox_write",
    mode: "overwrite_latest",
    repo,
    branch,
    path: OUTBOX_PATH,
    updatedAt,
    commit: result.data?.commit?.sha || null,
    githubOk: Boolean(result.ok),
    githubStatus: result.status,
    error: result.error || null,
  };
}

export default {
  runAdvisorOutboxAgent,
};
