// src/agentWorkspace/AgentWorkspaceResetReports.js
// ============================================================================
// AgentWorkspace Reset Reports
// Resets allowlisted agent_workspace/*.md reports before a command run.
// ============================================================================

import { emptyReport } from "./AgentWorkspaceReportBuilders.js";

export async function resetWorkspaceReportsForCommand({ command, reportService }) {
  const taskId = command?.taskId || "manual";
  const writes = [];

  writes.push(await reportService.writeMarkdown(
    "STATUS.md",
    emptyReport("STATUS", taskId),
    `reset status for ${taskId}`
  ));

  writes.push(await reportService.writeMarkdown(
    "LOOP_STATE.md",
    emptyReport("LOOP_STATE", taskId),
    `reset loop state for ${taskId}`
  ));

  writes.push(await reportService.writeMarkdown(
    "DEPLOY_REPORT.md",
    emptyReport("DEPLOY_REPORT", taskId),
    `reset deploy report for ${taskId}`
  ));

  writes.push(await reportService.writeMarkdown(
    "RENDER_REPORT.md",
    emptyReport("RENDER_REPORT", taskId),
    `reset render report for ${taskId}`
  ));

  writes.push(await reportService.writeMarkdown(
    "RENDER_LOGS_REPORT.md",
    emptyReport("RENDER_LOGS_REPORT", taskId),
    `reset render logs report for ${taskId}`
  ));

  writes.push(await reportService.writeMarkdown(
    "RENDER_DEPLOYS_REPORT.md",
    emptyReport("RENDER_DEPLOYS_REPORT", taskId),
    `reset render deploys report for ${taskId}`
  ));

  writes.push(await reportService.writeMarkdown(
    "RENDER_DEPLOY_REPORT.md",
    emptyReport("RENDER_DEPLOY_REPORT", taskId),
    `reset render deploy report for ${taskId}`
  ));

  writes.push(await reportService.writeMarkdown(
    "RENDER_STATUS_REPORT.md",
    emptyReport("RENDER_STATUS_REPORT", taskId),
    `reset render status report for ${taskId}`
  ));

  writes.push(await reportService.writeMarkdown(
    "DIAGNOSIS.md",
    emptyReport("DIAGNOSIS", taskId, "reset_before_command_run_no_diagnosis_yet"),
    `reset diagnosis for ${taskId}`
  ));

  writes.push(await reportService.writeMarkdown(
    "TEST_REPORT.md",
    emptyReport("TEST_REPORT", taskId, "reset_before_command_run_no_test_yet"),
    `reset test report for ${taskId}`
  ));

  writes.push(await reportService.writeMarkdown(
    "SEMANTIC_MAP_REPORT.md",
    emptyReport("SEMANTIC_MAP_REPORT", taskId, "reset_before_command_run_no_semantic_map_yet"),
    `reset semantic map report for ${taskId}`
  ));

  writes.push(await reportService.writeMarkdown(
    "PATCH_REQUESTS.md",
    emptyReport("PATCH_REQUESTS", taskId, "reset_before_command_run_no_patch_requested"),
    `reset patch requests for ${taskId}`
  ));

  return writes;
}

export default {
  resetWorkspaceReportsForCommand,
};
