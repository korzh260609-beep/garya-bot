// src/agentWorkspace/AgentWorkspaceChaosDiagFormatter.js
// ============================================================================
// AgentWorkspace chaos diagnostic formatter
// Purpose:
// - format read-only controlled chaos diagnostic snapshots
// - keep chaos output outside the large command runner
// - do not write files, DB, AI calls, pillars, env, or runtime prompts
// ============================================================================

function yesNo(value) {
  return value ? "yes" : "no";
}

function warningsText(data = {}) {
  return Array.isArray(data?.warnings) && data.warnings.length
    ? data.warnings.join(", ")
    : "-";
}

export function buildAgentWorkspaceChaosDiagOutput({ data, title = "AgentWorkspace bootstrap chaos diag" } = {}) {
  return [
    `🧪 ${title}`,
    "",
    `scenario: ${data?.scenario || "-"}`,
    `controlledSimulation: ${yesNo(data?.controlledSimulation)}`,
    "",
    `realReadOnly: ${yesNo(data?.realReadOnly)}`,
    `realDbWrites: ${yesNo(data?.realDbWrites)}`,
    `realAiCalls: ${yesNo(data?.realAiCalls)}`,
    `realTouchesPillars: ${yesNo(data?.realTouchesPillars)}`,
    `realRuntimePromptChanged: ${yesNo(data?.realRuntimePromptChanged)}`,
    `realFilesChanged: ${yesNo(data?.realFilesChanged)}`,
    "",
    `simulatedFailure: ${data?.simulatedFailure || "-"}`,
    `simulatedResult: ${data?.simulatedResult || "-"}`,
    `simulatedTouchesPillars: ${yesNo(data?.simulatedTouchesPillars)}`,
    `simulatedGithubApiAvailable: ${data?.simulatedGithubApiAvailable === false ? "no" : "-"}`,
    `simulatedMissingFile: ${data?.simulatedMissingFile || "-"}`,
    "",
    `filesExpected: ${data?.filesExpected ?? "-"}`,
    `filesOk: ${data?.filesOk ?? "-"}`,
    `filesFailed: ${data?.filesFailed ?? "-"}`,
    "",
    "Expected gate behavior:",
    data?.expectedGateBehavior || "-",
    "",
    `warnings: ${warningsText(data)}`,
    "",
    `Result: ${data?.ok === true ? "OK" : "FAILED"}`,
  ].join("\n");
}

export default {
  buildAgentWorkspaceChaosDiagOutput,
};
