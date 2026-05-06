// AGENT NOTE:
// GitHubActionsAgent report builder skeleton.
// Purpose: build safe compact GitHub Actions diagnostics reports.
// Do not add GitHub auth, GitHub writes, Render logic, AI calls, DB calls, or Telegram flow here.

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildGitHubActionsAgentStubReport({ action = "unknown", input = {} } = {}) {
  return {
    ok: true,
    agent: "github-actions-agent",
    mode: "skeleton",
    action: normalizeString(action) || "unknown",
    writes: false,
    githubReads: false,
    collectedAt: nowIso(),
    input,
    summary: "GitHubActionsAgent skeleton is registered but not connected to GitHub runtime yet.",
  };
}

export default {
  buildGitHubActionsAgentStubReport,
};
