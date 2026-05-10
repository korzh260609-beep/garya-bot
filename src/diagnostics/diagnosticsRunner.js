// AGENT NOTE:
// SG 2.0 Diagnostics Layer runner.
// Purpose: provide a bounded public diagnostics entry point without coupling diagnostics to Telegram or core message handling.
// Diagnostics may collect generated runtime reports, but must not mutate code, env, Render settings, GitHub settings, or transport logic.

import {
  OBSERVATION_TRIGGER_NAMES,
  runObservationTrigger,
} from "../agents/observation/triggers/index.js";
import { findCommitsByIntent } from "../agents/repo-commit-watcher-agent/repoCommitSearch.js";
import { runRenderEnvAgent } from "../agents/render-env-agent/renderEnvAgent.js";
import { runRepoRegistryAgent } from "../agents/repo-registry-agent/repoRegistryAgent.js";
import { runGetRenderLogsTask } from "../tasks/render/getRenderLogsTask.js";
import { executeGitHubApiRequest } from "../tools/github/githubApiClient.js";
import {
  getCurrentProjectBranch,
  getCurrentProjectRepository,
} from "../tools/github/githubProjectDefaults.js";
import { detectDiagnosticsIntent } from "./diagnosticsIntent.js";
import { buildDiagnosticsPlan } from "./diagnosticsPlan.js";
import { buildDiagnosticsReport } from "./diagnosticsReport.js";
import { runObservationLatestReportCheck } from "./observationLatestReportCheck.js";
import { runUsersIdentityLinkingCheck } from "./usersIdentityLinkingCheck.js";
import { runUsersIdentityLinkRequestsCheck } from "./usersIdentityLinkRequestsCheck.js";
import { runUsersIdentityRegistryCheck } from "./usersIdentityRegistryCheck.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLimit(value, fallback = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(1000, Math.trunc(n)));
}

function summarizeRenderLogs(result = {}) {
  if (!result.ok) return result.error || "Render logs check failed.";
  return `Render logs collected: ${result.logs_count ?? "unknown"} entries, path: ${result.path || "unknown"}.`;
}

function summarizeRenderEnv(result = {}) {
  if (!result.ok) return result.error || "Render env check failed.";
  return `Render env inventory collected: ${result.env_count ?? "unknown"} variables, path: ${result.path || "unknown"}.`;
}

function summarizeRepoRegistry(result = {}) {
  if (!result.ok) return result.error || "Repo registry check failed.";
  return `Repo registry collected: ${result.items_count ?? "unknown"} items, branch: ${result.branch || "unknown"}, path: ${result.path || "unknown"}.`;
}

function summarizeWorkflowRun(result = {}) {
  if (!result.ok) return result.error || "GitHub Actions check failed.";
  const run = result.latestRun;
  if (!run) return "GitHub Actions check completed, but no workflow run was found.";
  return `GitHub Actions latest run: ${run.name || result.workflow || "workflow"}, status=${run.status || "unknown"}, conclusion=${run.conclusion || "unknown"}.`;
}

function summarizeCommits(result = {}) {
  if (!result.ok) return result.error || "Recent commits check failed.";
  return result.summary?.text || `Recent commits checked: ${result.searched_commits ?? "unknown"}.`;
}

function summarizeObservationLatestReport(result = {}) {
  if (!result.ok) return result.error || result.summary || "Observation latest report check failed.";
  return result.summary || "Observation latest report check passed.";
}

function summarizeUsersIdentityRegistry(result = {}) {
  if (!result.ok) return result.error || result.summary || "Users identity registry check failed.";
  return result.summary || "Users identity registry check passed.";
}

function summarizeUsersIdentityLinking(result = {}) {
  if (!result.ok) return result.error || result.summary || "Users identity linking check failed.";
  return result.summary || "Users identity linking check passed.";
}

function summarizeUsersIdentityLinkRequests(result = {}) {
  if (!result.ok) return result.error || result.summary || "Users identity link requests check failed.";
  return result.summary || "Users identity link requests check passed.";
}

async function safeCheck(type, fn, summarize) {
  try {
    const data = await fn();
    return {
      ok: Boolean(data?.ok),
      type,
      summary: summarize(data),
      data,
    };
  } catch (error) {
    return {
      ok: false,
      type,
      summary: error?.message || `${type}_failed`,
      error: error?.message || `${type}_failed`,
    };
  }
}

async function safeRunObservationTrigger(input = {}, fallbackType = "observation_trigger_result") {
  try {
    return await runObservationTrigger(input);
  } catch (error) {
    return {
      ok: false,
      type: fallbackType,
      error: error?.message || "observation_trigger_failed",
    };
  }
}

async function safePublishDiagnosticsObservation(diagnosticsResult, context) {
  const result = await safeRunObservationTrigger({
    name: OBSERVATION_TRIGGER_NAMES.DIAGNOSTICS_FINISHED,
    payload: {
      diagnosticsResult,
    },
    context,
  }, "diagnostics_observation_publish_result");

  return {
    ok: Boolean(result?.ok),
    type: "diagnostics_observation_publish_result",
    observation: result?.observation || result,
  };
}

async function safePublishRuntimeStatusObservation() {
  const result = await safeRunObservationTrigger({
    name: OBSERVATION_TRIGGER_NAMES.RUNTIME_STATUS_REQUESTED,
  }, "runtime_status_observation_publish_result");

  return {
    ok: Boolean(result?.ok),
    type: "runtime_status_observation_publish_result",
    observation: result?.observation || result,
  };
}

async function checkLatestWorkflowRun({ repo, branch, workflow }) {
  const result = await executeGitHubApiRequest({
    method: "GET",
    path: `/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs`,
    query: {
      branch,
      per_page: 1,
    },
  });

  const latestRun = result?.formatted?.runs?.[0] || result?.data?.workflow_runs?.[0] || null;

  return {
    ok: Boolean(result.ok),
    type: "repo_latest_workflow_run_check",
    repo,
    branch,
    workflow,
    latestRun,
    latestStatus: latestRun?.status || null,
    latestConclusion: latestRun?.conclusion || null,
    latestHeadSha: latestRun?.commit_sha || latestRun?.head_sha || null,
    githubOk: Boolean(result.ok),
    githubStatus: result.status,
    error: result.error || null,
  };
}

function buildFinalDiagnosticsText({ report }) {
  const results = Array.isArray(report?.results) ? report.results : [];
  const failed = results.filter((item) => !item.ok);

  const lines = [
    "Диагностика SG выполнена.",
    "",
    "Проверено:",
    ...results.map((item) => `- ${item.type}: ${item.ok ? "OK" : "FAIL"} — ${item.summary}`),
    "",
    failed.length > 0
      ? `Проблемные проверки: ${failed.map((item) => item.type).join(", ")}.`
      : "Явных сбоев по собранным проверкам не найдено.",
    "",
    `Следующий шаг: ${report?.nextStep || "проверить детали failed-проверок перед изменением кода."}`,
  ];

  return lines.join("\n").trim();
}

export async function runDiagnosticsCheck(input = {}, context = {}) {
  if (!context?.isMonarch) {
    return {
      ok: false,
      type: "sg_diagnostics_check",
      error: "sg_diagnostics_not_allowed",
      finalText: "Диагностика доступна только монарху.",
    };
  }

  const text = typeof input.text === "string" && input.text.trim()
    ? input.text.trim()
    : String(context.latestUserText || "").trim();
  const intent = detectDiagnosticsIntent({ text });
  const plan = buildDiagnosticsPlan({
    text,
    intent,
    checks: input.checks,
  });
  const repo = normalizeString(input.repo) || getCurrentProjectRepository();
  const branch = normalizeString(input.branch) || getCurrentProjectBranch();
  const target = normalizeString(input.target) || "garya-bot";
  const workflow = normalizeString(input.workflow) || "sg2-smoke.yml";
  const logLimit = normalizeLimit(input.limit, 100);

  const checks = Array.isArray(plan.checks) ? plan.checks : [];
  const results = [];

  if (checks.includes("users_identity_registry")) {
    results.push(await safeCheck(
      "users_identity_registry",
      () => runUsersIdentityRegistryCheck(),
      summarizeUsersIdentityRegistry
    ));
  }

  if (checks.includes("users_identity_linking")) {
    results.push(await safeCheck(
      "users_identity_linking",
      () => runUsersIdentityLinkingCheck(),
      summarizeUsersIdentityLinking
    ));
  }

  if (checks.includes("users_identity_link_requests")) {
    results.push(await safeCheck(
      "users_identity_link_requests",
      () => runUsersIdentityLinkRequestsCheck(),
      summarizeUsersIdentityLinkRequests
    ));
  }

  if (checks.includes("observation_latest_report")) {
    results.push(await safeCheck(
      "observation_latest_report",
      () => runObservationLatestReportCheck({ name: "diagnostics-latest" }),
      summarizeObservationLatestReport
    ));
  }

  if (checks.includes("render_logs")) {
    results.push(await safeCheck(
      "render_logs",
      () => runGetRenderLogsTask({ limit: logLimit, target, level: "all" }),
      summarizeRenderLogs
    ));
  }

  if (checks.includes("render_env_inventory")) {
    results.push(await safeCheck(
      "render_env_inventory",
      () => runRenderEnvAgent({ target }),
      summarizeRenderEnv
    ));
  }

  if (checks.includes("github_actions_latest_run")) {
    results.push(await safeCheck(
      "github_actions_latest_run",
      () => checkLatestWorkflowRun({ repo, branch, workflow }),
      summarizeWorkflowRun
    ));
  }

  if (checks.includes("repo_registry")) {
    results.push(await safeCheck(
      "repo_registry",
      () => runRepoRegistryAgent({ repo, branch }),
      summarizeRepoRegistry
    ));
  }

  if (checks.includes("recent_commits")) {
    results.push(await safeCheck(
      "recent_commits",
      () => findCommitsByIntent({
        text: text || "diagnostics render deploy github actions registry",
        repo,
        branch,
        limit: 12,
      }),
      summarizeCommits
    ));
  }

  const report = buildDiagnosticsReport({
    plan,
    results,
  });
  const finalText = buildFinalDiagnosticsText({ report });
  const diagnosticsResult = {
    ok: report.ok,
    type: "sg_diagnostics_check",
    mode: "runtime_orchestration",
    text,
    intent,
    plan,
    report,
    finalText,
  };
  const observation = await safePublishDiagnosticsObservation(diagnosticsResult, context);
  const runtimeObservation = await safePublishRuntimeStatusObservation();

  return {
    ...diagnosticsResult,
    observation,
    runtimeObservation,
  };
}
