// SG 2.0 Diagnostics Layer plan builder.
// Purpose: build a safe diagnostics plan from structured intent/capability selection.
// Do not add keyword lists, phrase matching, slash-command parsing, AI calls, or transport coupling here.

import {
  getMigrationReadinessDiagnosticsChecks,
  isMigrationReadinessDiagnosticsRequest,
} from "./migrationReadinessDiagnosticsSuite.js";
import {
  getProjectMemoryProductionReadinessDiagnosticsChecks,
  isProjectMemoryProductionReadinessDiagnosticsRequest,
} from "./projectMemoryProductionReadinessDiagnosticsSuite.js";

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

function normalizeString(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeIntent(value) {
  const intent = value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return {
    domain: normalizeString(intent.domain),
    action: normalizeString(intent.action),
    target: normalizeString(intent.target),
    capability: normalizeString(intent.capability),
    diagnosticsSuite: normalizeString(intent.diagnosticsSuite),
    checks: Array.isArray(intent.checks)
      ? intent.checks.map((item) => normalizeString(item)).filter(Boolean)
      : [],
  };
}

function selectDiagnosticsChecks({ intent, requestedChecks }) {
  if (requestedChecks.length > 0) {
    return {
      checks: requestedChecks,
      selectedSuite: "explicit",
      routing: "explicit_checks",
    };
  }

  if (intent.checks.length > 0) {
    return {
      checks: intent.checks,
      selectedSuite: "intent_checks",
      routing: "structured_intent_checks",
    };
  }

  if (intent.capability === "migration_automatic_execution_preflight") {
    return {
      checks: ["migration_automatic_execution_preflight"],
      selectedSuite: "migration_automatic_execution_preflight",
      routing: "structured_capability",
    };
  }

  if (isMigrationReadinessDiagnosticsRequest({ intent })) {
    return {
      checks: getMigrationReadinessDiagnosticsChecks(),
      selectedSuite: "migration_readiness",
      routing: "structured_suite",
    };
  }

  if (isProjectMemoryProductionReadinessDiagnosticsRequest({ intent })) {
    return {
      checks: getProjectMemoryProductionReadinessDiagnosticsChecks(),
      selectedSuite: "project_memory_production_readiness",
      routing: "structured_suite",
    };
  }

  return {
    checks: DEFAULT_CHECKS,
    selectedSuite: "default",
    routing: "default",
  };
}

export function buildDiagnosticsPlan(input = {}) {
  const text = typeof input.text === "string" ? input.text.trim() : "";
  const intent = normalizeIntent(input.intent);
  const requestedChecks = Array.isArray(input.checks) ? input.checks.filter(Boolean) : [];
  const selection = selectDiagnosticsChecks({ intent, requestedChecks });

  return {
    ok: true,
    type: "sg_diagnostics_plan",
    mode: "read_only",
    text,
    intent,
    checks: selection.checks,
    selectedSuite: selection.selectedSuite,
    routing: {
      source: selection.routing,
      keywordMatchingUsed: false,
      phraseMatchingUsed: false,
    },
    rules: {
      noWrites: true,
      noSecrets: true,
      noSlashCommands: true,
      noTransportDependency: true,
      noCoreMutation: true,
      noMigrationExecution: true,
    },
  };
}

export function getDefaultDiagnosticsChecks() {
  return [...DEFAULT_CHECKS];
}
