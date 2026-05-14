// AGENT NOTE:
// SG 2.0 migration execution controller skeleton.
// Purpose: make an explicit migration execution decision from env, guard, plan, ledger, and DB availability.
// This controller must not execute SQL, mutate DB, run at startup, call AI, touch Telegram, or write Project Memory.

import { isDatabaseConfigured } from "../postgresClient.js";
import { buildMigrationExecutionGuard } from "./migrationExecutionGuard.js";
import { buildMigrationLedgerPlan } from "./migrationLedger.js";
import { buildMigrationPlan } from "./migrationRunner.js";
import { getMigrationRuntimeConfigFromEnv } from "./migrationRuntimeConfig.js";

export const MIGRATION_EXECUTION_CONTROLLER_VERSION = 1;

export const MIGRATION_EXECUTION_DECISIONS = Object.freeze({
  SKIP_ENV_DISABLED: "skip_env_disabled",
  BLOCKED_BY_GUARD: "blocked_by_guard",
  BLOCKED_DATABASE_NOT_CONFIGURED: "blocked_database_not_configured",
  READY_FOR_FUTURE_EXECUTION: "ready_for_future_execution",
});

export function buildMigrationExecutionDecision({
  runtimeConfig = getMigrationRuntimeConfigFromEnv(),
  guard = null,
  runnerPlan = null,
  ledgerPlan = null,
  databaseConfigured = isDatabaseConfigured(),
} = {}) {
  const resolvedGuard = guard || buildMigrationExecutionGuard({ runtimeConfig });
  const resolvedRunnerPlan = runnerPlan || buildMigrationPlan();
  const resolvedLedgerPlan = ledgerPlan || buildMigrationLedgerPlan();
  const runMigrationsOnBoot = Boolean(runtimeConfig?.env?.runMigrationsOnBoot?.enabled);
  const executionAllowed = Boolean(resolvedGuard.executionAllowed);
  const dbConfigured = Boolean(databaseConfigured);

  let decision = MIGRATION_EXECUTION_DECISIONS.READY_FOR_FUTURE_EXECUTION;
  let reason = "migration_execution_path_not_implemented_yet";

  if (!runMigrationsOnBoot) {
    decision = MIGRATION_EXECUTION_DECISIONS.SKIP_ENV_DISABLED;
    reason = "RUN_MIGRATIONS_ON_BOOT_disabled";
  } else if (!executionAllowed) {
    decision = MIGRATION_EXECUTION_DECISIONS.BLOCKED_BY_GUARD;
    reason = resolvedGuard.reason || "migration_execution_guard_blocked";
  } else if (!dbConfigured) {
    decision = MIGRATION_EXECUTION_DECISIONS.BLOCKED_DATABASE_NOT_CONFIGURED;
    reason = "database_not_configured";
  }

  return {
    ok: true,
    type: "migration_execution_decision",
    version: MIGRATION_EXECUTION_CONTROLLER_VERSION,
    mode: "decision_only",
    decision,
    reason,
    willMutateDatabase: false,
    runtimeConfig,
    guard: {
      ok: resolvedGuard.ok,
      executionAllowed: resolvedGuard.executionAllowed,
      reason: resolvedGuard.reason,
      willMutateDatabase: resolvedGuard.willMutateDatabase,
      env: resolvedGuard.env,
    },
    runnerPlan: {
      ok: resolvedRunnerPlan.ok,
      mode: resolvedRunnerPlan.mode,
      willMutateDatabase: resolvedRunnerPlan.willMutateDatabase,
      migrationCount: resolvedRunnerPlan.migrations.length,
    },
    ledgerPlan: {
      ok: resolvedLedgerPlan.ok,
      mode: resolvedLedgerPlan.mode,
      willMutateDatabase: resolvedLedgerPlan.willMutateDatabase,
      tableName: resolvedLedgerPlan.tableName,
      sqlCount: resolvedLedgerPlan.sqlCount,
    },
    database: {
      configured: dbConfigured,
    },
    rules: {
      decisionOnly: true,
      noSqlExecution: true,
      noDbMutation: true,
      noStartupExecution: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
      envFlagAloneDoesNotBypassGuard: true,
      futureExplicitApprovalRequired: true,
    },
  };
}

export async function runMigrationExecutionController(options = {}) {
  return buildMigrationExecutionDecision(options);
}

export default {
  MIGRATION_EXECUTION_CONTROLLER_VERSION,
  MIGRATION_EXECUTION_DECISIONS,
  buildMigrationExecutionDecision,
  runMigrationExecutionController,
};
