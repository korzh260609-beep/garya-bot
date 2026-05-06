// AGENT NOTE:
// DiagnosticsRenderAgent service skeleton.
// Purpose: define the Render diagnostics agent contract before config/runtime/Render API logic.
// Do not add Render API calls, GitHub writes, AI calls, DB calls, or Telegram flow here yet.

import { buildDiagnosticsRenderAgentStubReport } from "./DiagnosticsRenderAgentReportBuilder.js";

export class DiagnosticsRenderAgentService {
  async run(input = {}) {
    return buildDiagnosticsRenderAgentStubReport({
      action: input?.action || "run",
      input,
    });
  }

  async collectLogs(input = {}) {
    return buildDiagnosticsRenderAgentStubReport({
      action: "collect_logs",
      input,
    });
  }

  async collectDeploys(input = {}) {
    return buildDiagnosticsRenderAgentStubReport({
      action: "collect_deploys",
      input,
    });
  }

  async collectDeploy(input = {}) {
    return buildDiagnosticsRenderAgentStubReport({
      action: "collect_deploy",
      input,
    });
  }

  async collectStatus(input = {}) {
    return buildDiagnosticsRenderAgentStubReport({
      action: "collect_status",
      input,
    });
  }
}

export const diagnosticsRenderAgentService = new DiagnosticsRenderAgentService();

export default DiagnosticsRenderAgentService;
