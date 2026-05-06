// AGENT NOTE:
// RenderAgent report builder boundary.
// Purpose: expose Render-specific report builders from a simple top-level agent folder.
// Do not add GitHub Actions or PR/check report logic here.

export {
  buildDiagnosticsRenderAgentStubReport as buildRenderAgentStubReport,
  buildEmptyWorkspaceReport,
} from "../runtime-diagnostics/diagnostics-render-agent/DiagnosticsRenderAgentReportBuilder.js";
