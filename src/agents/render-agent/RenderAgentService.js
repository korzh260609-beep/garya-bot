// AGENT NOTE:
// RenderAgent public service.
// Purpose: provide a simple top-level Render agent boundary.
// Do not add GitHub Actions, PR/checks, Telegram flow, AI calls, DB calls, or Render writes here.

import { DiagnosticsRenderAgentService } from "../runtime-diagnostics/diagnostics-render-agent/DiagnosticsRenderAgentService.js";

export class RenderAgentService extends DiagnosticsRenderAgentService {}

export const renderAgentService = new RenderAgentService();

export default RenderAgentService;
