// src/agentWorkspace/AgentWorkspaceReportBuilders.js
// ============================================================================
// AgentWorkspace Report Builders
// Pure markdown builders for AgentWorkspace test/reset reports.
// ============================================================================

import { parseDiagnosticCommandLines } from "./AgentWorkspacePayloadParser.js";

export function nowIso() {
  return new Date().toISOString();
}

export function safeJson(value, max = 4000) {
  let text = "";
  try {
    text = JSON.stringify(value, null, 2);
  } catch {
    text = String(value || "");
  }

  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function formatUsd(value) {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(8);
}

function formatNullableNumber(value) {
  if (!Number.isFinite(value)) return "-";
  return String(value);
}

export function emptyReport(title, taskId, reason = "reset_before_command_run") {
  return `# ${title}\n\nReset before current command run.\n\n---\n\nTask ID: \`${taskId || "-"}\`\nUpdated at: \`${nowIso()}\`\nReason: \`${reason}\`\n\n---\n\n-\n`;
}

export function buildDiagnosticTestReport({ command, results, collectedAt }) {
  const executed = results.map((item) => `${item.command}: ${item.ok ? "OK" : "FAILED"}`).join("\n") || "-";
  const chatOutput = results.map((item) => {
    return [
      `## ${item.command}`,
      item.outputText || "-",
    ].join("\n");
  }).join("\n\n");
  const raw = results.map((item) => {
    return [
      `## ${item.command}`,
      `ok=${String(item.ok)}`,
      item.handler ? `handler=${item.handler}` : "handler=-",
      item.error ? `error=${item.error}` : "error=-",
      "```json",
      safeJson(item.data || item.output || item.messages || {}, 6000),
      "```",
    ].join("\n");
  }).join("\n\n");

  return `# TEST_REPORT\n\nSG diagnostic command results after workspace command execution.\n\n---\n\nTask ID: \`${command.taskId || "manual"}\`\nDeploy ID: \`${command.deployId || "-"}\`\nCommit: \`-\`\nTested at: \`${collectedAt}\`\nTested by: \`SG AgentWorkspaceCommandRunner\`\n\n---\n\n## Test commands\n\n\`\`\`text\n${parseDiagnosticCommandLines(command.payload).join("\n") || "-"}\n\`\`\`\n\n## Expected answers\n\nThe runner must execute read-only SG diagnostic chat commands and capture the same text SG would send to chat.\n\n## Actual answers\n\n\`\`\`text\n${executed}\n\`\`\`\n\n## Chat response logs\n\n\`\`\`text\n${chatOutput || "-"}\n\`\`\`\n\n## Render logs during test\n\n\`\`\`text\nUse RENDER_REPORT.md for RenderBridge logs collected by verify actions.\n\`\`\`\n\n## Result\n\n- \`${results.every((item) => item.ok) ? "DIAGNOSTICS_OK" : "DIAGNOSTICS_FAILED"}\`\n\n## Notes\n\n${raw || "-"}\n`;
}

export function buildRepoStateScanTestReport({ command, snapshot, collectedAt }) {
  return `# TEST_REPORT\n\nSG repo state scan result after workspace command execution.\n\n---\n\nTask ID: \`${command.taskId || "manual"}\`\nDeploy ID: \`${command.deployId || "-"}\`\nCommit: \`-\`\nTested at: \`${collectedAt}\`\nTested by: \`SG AgentWorkspaceCommandRunner\`\n\n---\n\n## Test command\n\n\`\`\`text\nRUN_REPO_STATE_SCAN\n\`\`\`\n\n## Result\n\n- \`${snapshot?.ok === true && snapshot?.persisted === true ? "REPO_STATE_SCAN_OK" : "REPO_STATE_SCAN_FAILED"}\`\n\n## Repo State\n\n\`\`\`text\nok: ${snapshot?.ok === true ? "yes" : "no"}\npersisted: ${snapshot?.persisted === true ? "yes" : "no"}\nrepo: ${snapshot?.repoFullName || "-"}\nbranch: ${snapshot?.branch || "-"}\nfiles: ${snapshot?.filesCount ?? "-"}\nmodules: ${snapshot?.modulesCount ?? "-"}\ndependencies: ${snapshot?.dependenciesCount ?? "-"}\ncontentLoaded: ${snapshot?.tree?.contentFilesLoaded ?? "-"}\ncontentSkipped: ${snapshot?.tree?.contentFilesSkipped ?? "-"}\nstructureComplete: ${snapshot?.tree?.structureComplete === true ? "yes" : "no"}\nhiddenFiles: ${snapshot?.tree?.hiddenFilesCount ?? "-"}\nscanRunId: ${snapshot?.persistence?.scanRunId || "-"}\nerror: ${snapshot?.error || snapshot?.persistence?.error || "-"}\n\`\`\`\n\n## Raw\n\n\`\`\`json\n${safeJson(snapshot || {}, 6000)}\n\`\`\`\n`;
}

export function buildRepoStateAgentTestReport({ command, result, collectedAt, resultStatus }) {
  const ai = result?.aiAnalysis || {};
  const meta = result?.aiMeta || {};
  const projectMap = result?.projectMap || {};
  const promptChars = ai?.promptChars || ai?.analysis?.promptChars || "-";
  const usage = ai?.usage || {};
  const reportResultStatus = resultStatus || (
    meta?.realAiBlocked === true
      ? "REAL_AI_BLOCKED"
      : result?.ok === true && result?.persisted === true && projectMap
        ? "REPO_STATE_AGENT_OK"
        : "REPO_STATE_AGENT_FAILED"
  );
  const aiModel = meta?.aiModel || usage?.model || "-";
  const aiUsedFallback = meta?.aiUsedFallback === true || usage?.usedFallback === true;
  const aiInputTokens = Number.isFinite(meta?.aiInputTokens) ? meta.aiInputTokens : usage?.inputTokens;
  const aiOutputTokens = Number.isFinite(meta?.aiOutputTokens) ? meta.aiOutputTokens : usage?.outputTokens;
  const aiTotalTokens = Number.isFinite(meta?.aiTotalTokens) ? meta.aiTotalTokens : usage?.totalTokens;
  const aiEstimatedUsd = Number.isFinite(meta?.aiEstimatedUsd) ? meta.aiEstimatedUsd : usage?.estimatedUsd;
  const aiPricingConfigured = meta?.aiPricingConfigured === true || usage?.pricingConfigured === true;

  return `# TEST_REPORT\n\nSG full repo state agent result after workspace command execution.\n\n---\n\nTask ID: \`${command.taskId || "manual"}\`\nDeploy ID: \`${command.deployId || "-"}\`\nCommit: \`-\`\nTested at: \`${collectedAt}\`\nTested by: \`SG AgentWorkspaceCommandRunner\`\n\n---\n\n## Test command\n\n\`\`\`text\nRUN_REPO_STATE_AGENT\n\`\`\`\n\n## Result\n\n- \`${reportResultStatus}\`\n\n## Technical map\n\n\`\`\`text\nok: ${result?.ok === true ? "yes" : "no"}\npersisted: ${result?.persisted === true ? "yes" : "no"}\nrepo: ${result?.repoFullName || "-"}\nbranch: ${result?.branch || "-"}\nfiles: ${result?.filesCount ?? "-"}\nmodules: ${result?.modulesCount ?? "-"}\ndependencies: ${result?.dependenciesCount ?? "-"}\nprojectMap: ${projectMap ? "yes" : "no"}\nprojectMapModules: ${Array.isArray(projectMap?.modules) ? projectMap.modules.length : "-"}\nprojectMapLinks: ${Array.isArray(projectMap?.moduleLinks) ? projectMap.moduleLinks.length : "-"}\nscanRunId: ${result?.persistence?.scanRunId || "-"}\nerror: ${result?.error || result?.persistence?.error || "-"}\n\`\`\`\n\n## Semantic AI map\n\n\`\`\`text\naiEnabled: ${ai?.enabled === true ? "yes" : "no"}\naiSkipped: ${ai?.skipped === true ? "yes" : "no"}\naiReused: ${ai?.reused === true ? "yes" : "no"}\naiDryRun: ${ai?.aiDryRun === true ? "yes" : "no"}\ntokensSpent: ${ai?.tokensSpent === true ? "yes" : "no"}\naiSource: ${ai?.aiSource || "unknown"}\naiReason: ${ai?.reason || meta?.reason || "-"}\nshouldAnalyze: ${meta?.shouldAnalyze === true ? "yes" : "no"}\naiForceAnalysis: ${meta?.forceAiAnalysis === true || ai?.forceAiAnalysis === true ? "yes" : "no"}\nallowRealAi: ${meta?.allowRealAi === true || ai?.allowRealAi === true ? "yes" : "no"}\nrealAiBlocked: ${meta?.realAiBlocked === true ? "yes" : "no"}\nblockReason: ${meta?.realAiBlocked === true ? "missing_allow_real_ai" : "-"}\naiModel: ${aiModel}\naiUsedFallback: ${aiUsedFallback ? "yes" : "no"}\naiInputTokens: ${formatNullableNumber(aiInputTokens)}\naiOutputTokens: ${formatNullableNumber(aiOutputTokens)}\naiTotalTokens: ${formatNullableNumber(aiTotalTokens)}\naiPricingConfigured: ${aiPricingConfigured ? "yes" : "no"}\naiEstimatedCostUsd: ${formatUsd(aiEstimatedUsd)}\noriginalShouldAnalyze: ${meta?.originalShouldAnalyze === true || ai?.originalShouldAnalyze === true ? "yes" : "no"}\npromptChars: ${promptChars}\nsignatureLength: ${meta?.projectMapSignature ? String(meta.projectMapSignature.length) : "-"}\nhasAnalysis: ${ai?.analysis ? "yes" : "no"}\n\`\`\`\n\n## Raw compact\n\n\`\`\`json\n${safeJson({
    ok: result?.ok,
    persisted: result?.persisted,
    resultStatus: reportResultStatus,
    blocked: meta?.realAiBlocked === true,
    blockReason: meta?.realAiBlocked === true ? "missing_allow_real_ai" : null,
    repoFullName: result?.repoFullName,
    branch: result?.branch,
    filesCount: result?.filesCount,
    modulesCount: result?.modulesCount,
    dependenciesCount: result?.dependenciesCount,
    scanRunId: result?.persistence?.scanRunId || null,
    aiUsage: {
      model: aiModel === "-" ? null : aiModel,
      usedFallback: aiUsedFallback,
      inputTokens: Number.isFinite(aiInputTokens) ? aiInputTokens : null,
      outputTokens: Number.isFinite(aiOutputTokens) ? aiOutputTokens : null,
      totalTokens: Number.isFinite(aiTotalTokens) ? aiTotalTokens : null,
      estimatedUsd: Number.isFinite(aiEstimatedUsd) ? aiEstimatedUsd : null,
      pricingConfigured: aiPricingConfigured,
    },
    aiAnalysis: result?.aiAnalysis || null,
    aiMeta: result?.aiMeta || null,
  }, 6000)}\n\`\`\`\n`;
}

export default {
  nowIso,
  safeJson,
  emptyReport,
  buildDiagnosticTestReport,
  buildRepoStateScanTestReport,
  buildRepoStateAgentTestReport,
};
