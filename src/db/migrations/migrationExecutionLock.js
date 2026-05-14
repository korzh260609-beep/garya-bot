// SG 2.0 migration execution lock skeleton.
// Purpose: model a future DB-backed lock for automatic migration execution.
// This module must not query, mutate DB, open transactions, run SQL, call AI, touch Telegram, or write Project Memory.

export const MIGRATION_EXECUTION_LOCK_VERSION = 1;

export const MIGRATION_EXECUTION_LOCK_REASONS = Object.freeze({
  NOT_IMPLEMENTED: "migration_execution_lock_not_implemented_yet",
  LOCK_REQUIRED: "migration_execution_lock_required_before_execution",
});

export function buildMigrationExecutionLockPlan() {
  return {
    ok: true,
    type: "migration_execution_lock_plan",
    version: MIGRATION_EXECUTION_LOCK_VERSION,
    mode: "plan_only",
    implemented: false,
    lockRequired: true,
    lockAcquired: false,
    reason: MIGRATION_EXECUTION_LOCK_REASONS.NOT_IMPLEMENTED,
    willMutateDatabase: false,
    safety: {
      noDbMutation: true,
      noTransactionOpened: true,
      noSqlExecution: true,
      noMigrationExecution: true,
      noLedgerWrite: true,
      noStartupExecution: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
    },
  };
}

export default {
  MIGRATION_EXECUTION_LOCK_VERSION,
  MIGRATION_EXECUTION_LOCK_REASONS,
  buildMigrationExecutionLockPlan,
};
