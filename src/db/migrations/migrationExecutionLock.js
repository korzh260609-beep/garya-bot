// SG 2.0 migration execution lock boundary.
// Purpose: model and optionally acquire a DB-backed advisory lock for automatic migration execution.
// This module must not execute migrations, open transactions, call AI, touch Telegram, or write Project Memory.
// Advisory lock acquire/release changes DB session state and is therefore guarded by explicitApproval.

export const MIGRATION_EXECUTION_LOCK_VERSION = 3;

export const MIGRATION_EXECUTION_LOCK_KEY = 20902001;

export const MIGRATION_EXECUTION_LOCK_REASONS = Object.freeze({
  LOCK_REQUIRED: "migration_execution_lock_required_before_execution",
  DB_BACKED_LOCK_PLAN_READY: "migration_db_backed_execution_lock_plan_ready",
  ACQUIRE_NOT_EXECUTED: "migration_execution_lock_acquire_not_executed_in_skeleton",
  EXPLICIT_APPROVAL_REQUIRED: "migration_execution_lock_explicit_approval_required",
  CLIENT_REQUIRED: "migration_execution_lock_client_required",
  LOCK_ACQUIRED: "migration_execution_lock_acquired",
  LOCK_NOT_ACQUIRED: "migration_execution_lock_not_acquired",
  LOCK_RELEASED: "migration_execution_lock_released",
  LOCK_RELEASE_FAILED: "migration_execution_lock_release_failed",
});

function hasQueryFunction(client) {
  return Boolean(client && typeof client.query === "function");
}

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
    mode: "db_backed_lock_boundary",
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
      advisoryLockAcquireRequiresExplicitApproval: true,
      advisoryLockReleaseRequiresExplicitApproval: true,
      noDbDataMutation: true,
      noTransactionOpened: true,
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

export async function acquireMigrationExecutionLock({
  client,
  explicitApproval = false,
  lockKey = MIGRATION_EXECUTION_LOCK_KEY,
} = {}) {
  const sql = buildMigrationExecutionLockSql({ lockKey });

  if (!explicitApproval) {
    return {
      ok: false,
      type: "migration_execution_lock_acquire_result",
      status: "skipped",
      reason: MIGRATION_EXECUTION_LOCK_REASONS.EXPLICIT_APPROVAL_REQUIRED,
      lockKey: sql.lockKey,
      lockAcquired: false,
      acquireAttempted: false,
      willMutateDatabase: false,
    };
  }

  if (!hasQueryFunction(client)) {
    return {
      ok: false,
      type: "migration_execution_lock_acquire_result",
      status: "skipped",
      reason: MIGRATION_EXECUTION_LOCK_REASONS.CLIENT_REQUIRED,
      lockKey: sql.lockKey,
      lockAcquired: false,
      acquireAttempted: false,
      willMutateDatabase: false,
    };
  }

  const result = await client.query(sql.acquireSql, [sql.lockKey]);
  const acquired = result?.rows?.[0]?.acquired === true;

  return {
    ok: acquired,
    type: "migration_execution_lock_acquire_result",
    status: acquired ? "acquired" : "not_acquired",
    reason: acquired
      ? MIGRATION_EXECUTION_LOCK_REASONS.LOCK_ACQUIRED
      : MIGRATION_EXECUTION_LOCK_REASONS.LOCK_NOT_ACQUIRED,
    lockKey: sql.lockKey,
    lockAcquired: acquired,
    acquireAttempted: true,
    willMutateDatabase: false,
    safety: {
      advisorySessionStateChanged: acquired,
      noDbDataMutation: true,
      noTransactionOpened: true,
      noMigrationExecution: true,
      noLedgerWrite: true,
      noSchemaCreation: true,
    },
  };
}

export async function releaseMigrationExecutionLock({
  client,
  explicitApproval = false,
  lockKey = MIGRATION_EXECUTION_LOCK_KEY,
} = {}) {
  const sql = buildMigrationExecutionLockSql({ lockKey });

  if (!explicitApproval) {
    return {
      ok: false,
      type: "migration_execution_lock_release_result",
      status: "skipped",
      reason: MIGRATION_EXECUTION_LOCK_REASONS.EXPLICIT_APPROVAL_REQUIRED,
      lockKey: sql.lockKey,
      lockReleased: false,
      releaseAttempted: false,
      willMutateDatabase: false,
    };
  }

  if (!hasQueryFunction(client)) {
    return {
      ok: false,
      type: "migration_execution_lock_release_result",
      status: "skipped",
      reason: MIGRATION_EXECUTION_LOCK_REASONS.CLIENT_REQUIRED,
      lockKey: sql.lockKey,
      lockReleased: false,
      releaseAttempted: false,
      willMutateDatabase: false,
    };
  }

  const result = await client.query(sql.releaseSql, [sql.lockKey]);
  const released = result?.rows?.[0]?.released === true;

  return {
    ok: released,
    type: "migration_execution_lock_release_result",
    status: released ? "released" : "not_released",
    reason: released
      ? MIGRATION_EXECUTION_LOCK_REASONS.LOCK_RELEASED
      : MIGRATION_EXECUTION_LOCK_REASONS.LOCK_RELEASE_FAILED,
    lockKey: sql.lockKey,
    lockReleased: released,
    releaseAttempted: true,
    willMutateDatabase: false,
    safety: {
      advisorySessionStateChanged: released,
      noDbDataMutation: true,
      noTransactionOpened: true,
      noMigrationExecution: true,
      noLedgerWrite: true,
      noSchemaCreation: true,
    },
  };
}

export default {
  MIGRATION_EXECUTION_LOCK_VERSION,
  MIGRATION_EXECUTION_LOCK_KEY,
  MIGRATION_EXECUTION_LOCK_REASONS,
  buildMigrationExecutionLockSql,
  buildMigrationExecutionLockPlan,
  acquireMigrationExecutionLock,
  releaseMigrationExecutionLock,
};
