// SG 2.0 Diagnostics Layer plan builder.
// Purpose: build a safe diagnostics plan from intent and user text.

const DEFAULT_CHECKS = [
  "users_identity_registry",
  "users_identity_linking",
  "users_identity_link_requests",
  "observation_latest_report",
  "observation_journal_health_latest",
  "observation_journal_status",
  "render_logs",
  "render_env_inventory",
  "github_actions_latest_run",
  "repo_latest_head",
  "repo_registry",
  "recent_commits",
];

export function buildDiagnosticsPlan(input = {}) {
  const text = typeof input.text === "string" ? input.text.trim() : "";
  const intent = input.intent || {};
  const requestedChecks = Array.isArray(input.checks) ? input.checks.filter(Boolean) : [];
  const checks = requestedChecks.length > 0 ? requestedChecks : DEFAULT_CHECKS;

  return {
    ok: true,
    type: "sg_diagnostics_plan",
    mode: "read_only",
    text,
    intent,
    checks,
    rules: {
      noWrites: true,
      noSecrets: true,
      noSlashCommands: true,
      noTransportDependency: true,
      noCoreMutation: true,
    },
  };
}

export function getDefaultDiagnosticsChecks() {
  return [...DEFAULT_CHECKS];
}
