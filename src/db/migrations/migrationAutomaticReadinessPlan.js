// SG 2.0 automatic migration readiness plan skeleton.
// Purpose: expose future DB readiness requirements for automatic migration execution without running queries.
// This module must not query, mutate DB, open transactions, run SQL, call AI, touch Telegram, or write Project Memory.

export const MIGRATION_AUTOMATIC_READINESS_PLAN_VERSION = 1;

export function buildMigrationDbReadinessPlan({ databaseConfigured = false } = {}) {
  const dbConfigured = Boolean(databaseConfigured);

  return {
    ok: true,
    type: "migration_automatic_db_readiness_plan",
    version: MIGRATION_AUTOMATIC_READINESS_PLAN_VERSION,
    mode: "plan_only",
    implemented: false,
    databaseConfigured: dbConfigured,
    connectivityChecked: false,
    reason: dbConfigured
      ? "live_db_connectivity_check_required_before_future_execution"
      : "database_not_configured_or_not_injected",
    willMutateDatabase: false,
    safety: {
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
  MIGRATION_AUTOMATIC_READINESS_PLAN_VERSION,
  buildMigrationDbReadinessPlan,
};
