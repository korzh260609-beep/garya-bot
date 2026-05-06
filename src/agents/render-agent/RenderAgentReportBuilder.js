// AGENT NOTE:
// RenderAgent report builder boundary.
// Purpose: expose Render-specific report builders from a simple top-level agent folder.
// Do not add GitHub Actions or PR/check report logic here.

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildRenderAgentStubReport({ action = "unknown", input = {} } = {}) {
  return {
    ok: true,
    agent: "render-agent",
    mode: "skeleton",
    action: normalizeString(action) || "unknown",
    writes: false,
    renderReads: false,
    collectedAt: nowIso(),
    input,
    summary: "RenderAgent skeleton is registered. Use explicit collect methods for Render diagnostics.",
  };
}

export function buildRenderAgentClientReport({ action = "unknown", input = {}, result = {} } = {}) {
  return {
    ok: result?.ok === true,
    agent: "render-agent",
    mode: "direct-client-skeleton",
    action: normalizeString(action) || "unknown",
    writes: false,
    renderReads: result?.renderReads === true,
    collectedAt: nowIso(),
    input,
    result,
    summary: "RenderAgent is connected directly to the read-only RenderClient skeleton.",
  };
}

export function buildEmptyWorkspaceReport({ title, taskId = "manual", reason = "not_collected_yet" } = {}) {
  const safeTitle = normalizeString(title) || "WORKSPACE_REPORT";
  const safeTaskId = normalizeString(taskId) || "manual";
  const safeReason = normalizeString(reason) || "not_collected_yet";

  return `# ${safeTitle}\n\nWorkspace report placeholder.\n\n---\n\nState: \`EMPTY\`\nTask ID: \`${safeTaskId}\`\nReason: \`${safeReason}\`\nUpdated at: \`${nowIso()}\`\n\n---\n\nNo current data has been collected for this report.\n`;
}

export default {
  buildRenderAgentStubReport,
  buildRenderAgentClientReport,
  buildEmptyWorkspaceReport,
};
