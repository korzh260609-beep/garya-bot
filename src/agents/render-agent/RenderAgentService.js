// AGENT NOTE:
// RenderAgent public service.
// Purpose: provide a simple top-level Render agent boundary.
// Do not add GitHub Actions, PR/checks, Telegram flow, AI calls, DB calls, or Render writes here.

import { renderClient } from "../../integrations/render/index.js";
import { buildRenderAgentEnvStatusReport } from "./RenderAgentEnvDiagnostics.js";
import { buildRenderAgentClientReport, buildRenderAgentStubReport } from "./RenderAgentReportBuilder.js";

export class RenderAgentService {
  async run(input = {}) {
    return buildRenderAgentStubReport({
      action: input?.action || "run",
      input,
    });
  }

  async collectEnvStatus(input = {}) {
    return buildRenderAgentEnvStatusReport({ input });
  }

  async collectLogs(input = {}) {
    const result = await renderClient.listLogs(input);

    return buildRenderAgentClientReport({
      action: "collect_logs",
      input,
      result,
    });
  }

  async collectDeploys(input = {}) {
    const result = await renderClient.listDeploys(input);

    return buildRenderAgentClientReport({
      action: "collect_deploys",
      input,
      result,
    });
  }

  async collectDeploy(input = {}) {
    const result = await renderClient.getDeploy(input);

    return buildRenderAgentClientReport({
      action: "collect_deploy",
      input,
      result,
    });
  }

  async collectStatus(input = {}) {
    const result = renderClient.getDiagnostics(input);

    return buildRenderAgentClientReport({
      action: "collect_status",
      input,
      result,
    });
  }
}

export const renderAgentService = new RenderAgentService();

export default RenderAgentService;
