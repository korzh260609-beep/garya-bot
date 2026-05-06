// AGENT NOTE:
// RenderAgent env/status diagnostics helper.
// Purpose: expose Render readiness without leaking secret values.
// Do not add GitHub Actions, PR/checks, Telegram flow, AI calls, DB calls, or Render writes here.

import { getRenderConfigForDiagnostics } from "../../integrations/render/index.js";

function buildReadyReason(diagnostics = {}) {
  if (!diagnostics.enabled) return "render_integration_disabled";
  if (!diagnostics.hasApiKey) return "render_api_key_missing";
  return "ready";
}

export function collectRenderAgentEnvStatusDiagnostics() {
  const diagnostics = getRenderConfigForDiagnostics();

  return {
    renderIntegrationEnabled: diagnostics.enabled === true,
    renderApiKeyConfigured: diagnostics.hasApiKey === true,
    renderDefaultServiceIdConfigured: diagnostics.defaultServiceIdConfigured === true,
    renderDefaultOwnerIdConfigured: diagnostics.defaultOwnerIdConfigured === true,
    renderApiBaseUrlConfigured: Boolean(diagnostics.apiBaseUrl),
    timeoutMs: diagnostics.timeoutMs,
    defaultLogLimit: diagnostics.defaultLogLimit,
    defaultDeployLimit: diagnostics.defaultDeployLimit,
    defaultLogWindowMinutes: diagnostics.defaultLogWindowMinutes,
    ready: diagnostics.ready === true,
    reason: buildReadyReason(diagnostics),
  };
}

export function buildRenderAgentEnvStatusReport({ input = {} } = {}) {
  const diagnostics = collectRenderAgentEnvStatusDiagnostics();

  return {
    ok: diagnostics.ready === true,
    agent: "render-agent",
    mode: "env-status-diagnostics",
    action: "collect_env_status",
    writes: false,
    renderReads: false,
    input,
    diagnostics,
    summary: diagnostics.ready
      ? "RenderAgent env/status diagnostics are ready. Render API key is configured and integration is enabled."
      : `RenderAgent env/status diagnostics are not ready: ${diagnostics.reason}.`,
  };
}
