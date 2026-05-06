// AGENT NOTE:
// DiagnosticsRenderAgent report builder skeleton.
// Purpose: build safe Advisor-readable report objects without Render API calls or writes.

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildDiagnosticsRenderAgentStubReport({ action = "unknown", input = {} } = {}) {
  return {
    ok: true,
    agent: "diagnostics-render-agent",
    mode: "skeleton",
    action: normalizeString(action) || "unknown",
    writes: false,
    renderReads: false,
    collectedAt: nowIso(),
    input,
    summary: "DiagnosticsRenderAgent skeleton is registered but not connected to Render runtime yet.",
  };
}

export function buildEmptyWorkspaceReport({ title, taskId = "manual", reason = "not_collected_yet" } = {}) {
  const safeTitle = normalizeString(title) || "WORKSPACE_REPORT";
  const safeTaskId = normalizeString(taskId) || "manual";
  const safeReason = normalizeString(reason) || "not_collected_yet";

  return `# ${safeTitle}\n\nWorkspace report placeholder.\n\n---\n\nState: \`EMPTY\`\nTask ID: \`${safeTaskId}\`\nReason: \`${safeReason}\`\nUpdated at: \`${nowIso()}\`\n\n---\n\nNo current data has been collected for this report.\n`;
}

export default {
  buildDiagnosticsRenderAgentStubReport,
  buildEmptyWorkspaceReport,
};
