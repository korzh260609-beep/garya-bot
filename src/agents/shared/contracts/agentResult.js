// AGENT NOTE:
// SG 2.0 shared agent result contract.
// Purpose: keep repo-facing agents read-only, explicit, and non-state-changing by default.
// Do not add runtime execution, Telegram commands, AI calls, DB writes, or external side effects here.

export function createAgentResult({
  ok = true,
  agent,
  capability = "read_only",
  data = {},
  warnings = [],
  errors = [],
  metadata = {},
} = {}) {
  return {
    ok: Boolean(ok),
    agent: agent || "unknown-agent",
    capability,
    canChangeState: false,
    tokensSpent: false,
    data: data && typeof data === "object" ? data : {},
    warnings: Array.isArray(warnings) ? warnings : [],
    errors: Array.isArray(errors) ? errors : [],
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  };
}

export function createAgentErrorResult({ agent, error, metadata = {} } = {}) {
  return createAgentResult({
    ok: false,
    agent,
    errors: [String(error || "unknown_agent_error")],
    metadata,
  });
}

export default {
  createAgentResult,
  createAgentErrorResult,
};
