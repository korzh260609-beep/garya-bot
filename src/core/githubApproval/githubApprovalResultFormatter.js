// AGENT NOTE:
// SG 2.0 GitHub approval result formatter.
// Purpose: isolate user-facing formatting for GitHub approval callback results.
// Do not execute GitHub requests or access Telegram delivery here.

function formatSummary(summary = {}) {
  return [
    `repo: ${summary.repo || "unknown"}`,
    `branch: ${summary.branch || "unknown"}`,
    `action: ${summary.action || "unknown"}`,
    `target: ${summary.target || "unknown"}`,
  ].join("\n");
}

export function formatGithubWriteResult(result = {}) {
  if (!result.ok) {
    return [
      "❌ GitHub-действие не выполнено.",
      "",
      `approval: ${result.approval_id || "unknown"}`,
      `error: ${result.error || "unknown error"}`,
    ].join("\n");
  }

  const commitSha = result?.data?.commit?.sha || result?.data?.sha || null;

  return [
    "✅ GitHub-действие выполнено.",
    "",
    `approval: ${result.approval_id || "unknown"}`,
    `status: ${result.status || "unknown"}`,
    "",
    formatSummary(result.summary),
    commitSha ? `\ncommit: ${commitSha}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatGithubCancelResult(result = {}) {
  if (!result.ok) {
    return [
      "❌ GitHub-действие не отменено.",
      "",
      `approval: ${result.approval_id || "unknown"}`,
      `error: ${result.error || "unknown error"}`,
    ].join("\n");
  }

  return [
    "✅ GitHub-действие отменено.",
    "",
    `approval: ${result.approval_id || "unknown"}`,
    "Запись в репозиторий не выполнялась.",
  ].join("\n");
}
