// AGENT NOTE:
// SG 2.0 Diagnostics checks runner.
// Purpose: bridge diagnostics orchestration to the Diagnostics Check Agent.
// Trigger-first rule: checks are executed through the diagnostics check agent registry, not embedded here.
// Do not add Telegram integration, AI calls, memory writes, raw logs, raw provider IDs, autonomous behavior, or code/env mutations here.

import { runDiagnosticsCheckAgent } from "../agents/diagnostics-check-agent/diagnosticsCheckAgent.js";
import { diagnosticsCheckRegistry } from "../agents/diagnostics-check-agent/diagnosticsCheckRegistry.js";

export async function runDiagnosticsChecks(input = {}) {
  const agentResult = await runDiagnosticsCheckAgent({
    ...input,
    registry: diagnosticsCheckRegistry,
  });

  return Array.isArray(agentResult.results) ? agentResult.results : [];
}

export default {
  runDiagnosticsChecks,
};
