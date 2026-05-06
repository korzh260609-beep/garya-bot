// AGENT NOTE:
// Agent workspace cleaner skeleton.
// Purpose: define automatic cleanup/reset plan for allowlisted workspace reports.
// This skeleton returns a write plan only; it does not perform GitHub writes.

import {
  AGENT_WORKSPACE_CLEANABLE_REPORT_PATHS,
  isProtectedWorkspacePath,
} from "./AgentWorkspaceReportPaths.js";
import { buildEmptyWorkspaceReport } from "../../runtime-diagnostics/diagnostics-render-agent/DiagnosticsRenderAgentReportBuilder.js";

function titleFromPath(path) {
  const fileName = String(path || "").split("/").pop() || "WORKSPACE_REPORT.md";
  return fileName.replace(/\.md$/i, "");
}

export function buildAgentWorkspaceCleanupPlan({ taskId = "manual", reason = "reset_before_command_run" } = {}) {
  return AGENT_WORKSPACE_CLEANABLE_REPORT_PATHS.map((path) => {
    if (isProtectedWorkspacePath(path)) {
      return {
        path,
        allowed: false,
        reason: "protected_workspace_path",
        content: "",
      };
    }

    return {
      path,
      allowed: true,
      reason,
      content: buildEmptyWorkspaceReport({
        title: titleFromPath(path),
        taskId,
        reason,
      }),
    };
  });
}

export default {
  buildAgentWorkspaceCleanupPlan,
};
