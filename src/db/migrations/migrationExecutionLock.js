// SG 2.0 migration execution lock skeleton.
// Purpose: model a future DB-backed lock for automatic migration execution.
// This module must not mutate DB, open transactions, execute migrations, run AI, touch Telegram, or write Project Memory.
// Advisory lock acquire is intentionally not executed here because it changes DB session state.

export const MIGRATION_EXECUTION_LOCK_VERSION = 2;

export const MIGRATION_EXECUTION_LOCK_KEY = 20902001;

export const MIGRATION_EXECUTION_LOCK_REASONS = Object.freeze({
  LOCK_REQUIRED: "migration_execution_lock_required_before_execution",
  DB_BACKED_LOCK_PLAN_READY: "migration_db_backed_execution_lock_plan_ready",
  ACQUIRE_NOT_EXECUTED: "migration_execution_lock_acquire_not_executed_in_skeleton",
});

export function buildMigrationExecutionLockSql({ lockKey = MIGRATION_EXECUTION_LOCK_KEY } = {}) {
  const normalizedLockKey = Number(lockKey);

  if (!Number.isSafeInteger(normalizedLockKey)) {
    return {
      ok: false,
      lockKey: null,
      acquireSql: null,
      releaseSql: null,
      reason: "migration_execution_lock_key_invalid",
    };
  }

  return {
    ok: true,
    lockKey: normalizedLockKey,
    acquireSql: "SELECT pg_try_advisory_lock($1) AS acquired;",
    releaseSql: "SELECT pg_advisory_unlock($1) AS released;",
    reason: MIGRATION_EXECUTION_LOCK_REASONS.DB_BACKED_LOCK_PLAN_READY,
  };
}

export function buildMigrationExecutionLockPlan({
  lockKey = MIGRATION_EXECUTION_LOCK_KEY,
  databaseConfigured = false,
  allowAcquire = false,
} = {}) {
  const sql = buildMigrationExecutionLockSql({ lockKey });
  const acquireAllowed = Boolean(allowAcquire);

  return {
    ok: sql.ok === true,
    type: "migration_execution_lock_plan",
    version: MIGRATION_EXECUTION_LOCK_VERSION,
    mode: "db_backed_lock_plan_only",
    implemented: true,
    lockRequired: true,
    databaseConfigured: Boolean(databaseConfigured),
    lockKey: sql.lockKey,
    lockAcquired: false,
    acquireAllowed,
    acquireAttempted: false,
    reason: acquireAllowed
      ? MIGRATION_EXECUTION_LOCK_REASONS.ACQUIRE_NOT_EXECUTED
      : MIGRATION_EXECUTION_LOCK_REASONS.DB_BACKED_LOCK_PLAN_READY,
    sql: {
      acquire: sql.acquireSql,
      release: sql.releaseSql,
    },
    willMutateDatabase: false,
    safety: {
      dbBackedBoundaryDefined: true,
      advisoryLockAcquireNotExecuted: true,
      advisoryLockReleaseNotExecuted: true,
      noDbMutation: true,
      noTransactionOpened: true,
      noSqlExecution: true,
      noMigrationExecution: true,
      noLedgerWrite: true,
      noSchemaCreation: true,
      noStartupExecution: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
    },
  };
}

export default {
  MIGRATION_EXECUTION_LOCK_VERSION,
  MIGRATION_EXECUTION_LOCK_KEY,
  MIGRATION_EXECUTION_LOCK_REASONS,
  buildMigrationExecutionLockSql,
  buildMigrationExecutionLockPlan,
};
