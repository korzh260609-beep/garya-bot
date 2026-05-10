// AGENT NOTE:
// SG 2.0 Diagnostics Check Agent.
// Purpose: execute bounded read-only diagnostics checks for the observation nervous system.
// Trigger-first rule: this agent is called by diagnostics/trigger flows, not by Telegram commands directly.
// Do not add Telegram integration, AI calls, memory writes, raw logs, raw provider IDs, autonomous behavior, or mutations here.

export async function safeDiagnosticsAgentCheck(type, fn, summarize) {
  try {
    const data = await fn();

    return {
      ok: Boolean(data?.ok),
      type,
      summary: summarize(data),
      data,
    };
  } catch (error) {
    return {
      ok: false,
      type,
      summary: error?.message || `${type}_failed`,
      error: error?.message || `${type}_failed`,
    };
  }
}

export async function runDiagnosticsCheckAgent(input = {}) {
  const checks = Array.isArray(input.checks) ? input.checks : [];
  const registry = Array.isArray(input.registry) ? input.registry : [];
  const results = [];

  for (const checkName of checks) {
    const handler = registry.find((item) => item?.name === checkName);

    if (!handler) continue;

    results.push(await safeDiagnosticsAgentCheck(
      handler.name,
      () => handler.run(input),
      handler.summarize
    ));
  }

  return {
    ok: results.every((item) => item.ok),
    type: "diagnostics_check_agent_result",
    checks_requested: checks.length,
    checks_executed: results.length,
    results,
  };
}

export default {
  runDiagnosticsCheckAgent,
  safeDiagnosticsAgentCheck,
};
