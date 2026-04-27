// src/agentWorkspace/AgentWorkspaceBootstrapReader.js
// ============================================================================
// AgentWorkspace bootstrap reader
// Purpose:
// - read repo-level agent instructions before/inside AgentWorkspace diagnostics
// - keep this read-only
// - do not write source, pillars, env, or workspace reports
// ============================================================================

import fetch from "node-fetch";
import { getAgentWorkspaceConfig } from "./AgentWorkspaceConfig.js";

const BOOTSTRAP_FILES = Object.freeze([
  "AGENTS.md",
  "agent_workspace/START_HERE.md",
  "agent_workspace/ADVISOR_PROTOCOL.md",
  "agent_workspace/COMMANDS.md",
  "agent_workspace/TEST_REPORT.md",
]);

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fromBase64Utf8(text) {
  return Buffer.from(String(text || ""), "base64").toString("utf8");
}

function shortHashText(value = "") {
  const text = String(value || "");
  let hash = 0;

  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

function buildContentsUrl({ cfg, path }) {
  const safePath = String(path || "")
    .replace(/^\/+/, "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${cfg.githubApiBaseUrl}/repos/${cfg.repoFullName}/contents/${safePath}`;
}

async function readRepoFile({ cfg, path }) {
  const url = `${buildContentsUrl({ cfg, path })}?ref=${encodeURIComponent(cfg.branch)}`;

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${cfg.githubToken}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
  });

  const rawText = await response.text();
  let parsed = null;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = rawText;
  }

  if (!response.ok) {
    return {
      path,
      ok: false,
      status: response.status,
      error: typeof parsed === "string" ? parsed.slice(0, 300) : JSON.stringify(parsed).slice(0, 300),
      chars: 0,
      sha: null,
      hash: null,
      required: true,
    };
  }

  const content = parsed?.content ? fromBase64Utf8(parsed.content) : "";

  return {
    path,
    ok: true,
    status: response.status,
    error: null,
    chars: content.length,
    sha: parsed?.sha || null,
    hash: shortHashText(content),
    required: true,
  };
}

export async function buildAgentWorkspaceBootstrapSnapshot({ config } = {}) {
  const cfg = config || getAgentWorkspaceConfig();
  const snapshot = {
    ok: false,
    readOnly: true,
    dbWrites: false,
    aiCalls: false,
    touchesPillars: false,
    runtimePromptChanged: false,
    repoFullName: cfg.repoFullName,
    branch: cfg.branch,
    filesExpected: BOOTSTRAP_FILES.length,
    filesOk: 0,
    filesFailed: 0,
    files: [],
    warnings: [],
  };

  if (!cfg.enabled || !cfg.githubToken || !cfg.repoFullName || !cfg.branch) {
    snapshot.warnings.push("agent_workspace_config_not_ready_for_bootstrap_read");
    return snapshot;
  }

  for (const path of BOOTSTRAP_FILES) {
    const item = await readRepoFile({ cfg, path });
    snapshot.files.push(item);
  }

  snapshot.filesOk = snapshot.files.filter((item) => item.ok).length;
  snapshot.filesFailed = snapshot.files.filter((item) => !item.ok).length;
  snapshot.ok = snapshot.filesFailed === 0 && snapshot.filesOk === snapshot.filesExpected;

  if (!snapshot.ok) {
    snapshot.warnings.push("bootstrap_required_files_missing_or_unreadable");
  }

  return snapshot;
}

export default {
  buildAgentWorkspaceBootstrapSnapshot,
};
