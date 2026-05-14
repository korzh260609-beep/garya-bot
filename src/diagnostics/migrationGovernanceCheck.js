import { buildMigrationExecutionGuard } from "../db/migrations/migrationExecutionGuard.js";
import { buildMigrationLedgerPlan } from "../db/migrations/migrationLedger.js";
import { buildMigrationPlan } from "../db/migrations/migrationRunner.js";

export const MIGRATION_GOVERNANCE_CHECK_NAME = "migration_governance";

export function runMigrationGovernanceCheck() {
  const runnerPlan = buildMigrationPlan();
  const ledgerPlan = buildMigrationLedgerPlan();
  const executionGuard = buildMigrationExecutionGuard();

  const willMutateDatabase = Boolean(
    runnerPlan.willMutateDatabase
    || ledgerPlan.willMutateDatabase
    || executionGuard.willMutateDatabase
  );

  const executionAllowed = Boolean(executionGuard.executionAllowed);

  return {
    ok: runnerPlan.ok === true && ledgerPlan.ok === true && executionAllowed === false && willMutateDatabase === false,
    type: "diagnostics_check",
    name: MIGRATION_GOVERNANCE_CHECK_NAME,
    summary: "Migration governance is plan-only and execution is blocked.",
    willMutateDatabase,
    executionAllowed,
    runnerPlan: {
      ok: runnerPlan.ok,
      type: runnerPlan.type,
      mode: runnerPlan.mode,
      willMutateDatabase: runnerPlan.willMutateDatabase,
      migrationCount: runnerPlan.migrations.length,
    },
    ledgerPlan: {
      ok: ledgerPlan.ok,
      type: ledgerPlan.type,
      mode: ledgerPlan.mode,
      tableName: ledgerPlan.tableName,
      willMutateDatabase: ledgerPlan.willMutateDatabase,
      sqlCount: ledgerPlan.sqlCount,
    },
    executionGuard: {
      ok: executionGuard.ok,
      type: executionGuard.type,
      executionAllowed: executionGuard.executionAllowed,
      reason: executionGuard.reason,
      willMutateDatabase: executionGuard.willMutateDatabase,
      env: executionGuard.env,
    },
    safety: {
      noDbMutation: willMutateDatabase === false,
      executionBlocked: executionAllowed === false,
      noStartupExecution: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
      existingMigrationBootEnvRecognized: executionGuard.env?.runMigrationsOnBootEnvKey === "RUN_MIGRATIONS_ON_BOOT",
      envFlagAloneDoesNotBypassGuard: executionGuard.rules?.envFlagAloneDoesNotBypassGuard === true,
    },
  };
}

export default {
  MIGRATION_GOVERNANCE_CHECK_NAME,
  runMigrationGovernanceCheck,
};
