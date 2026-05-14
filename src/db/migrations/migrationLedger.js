// AGENT NOTE:
// SG 2.0 migration ledger skeleton.
// Purpose: define reviewable migration ledger metadata and SQL text builders without executing database changes.
// Do not import postgresClient, run queries, write Project Memory, call AI, touch Telegram, or add startup execution here.

export const MIGRATION_LEDGER_TABLE = "sg_schema_migrations";

export function getMigrationLedgerTableName() {
  return MIGRATION_LEDGER_TABLE;
}

export function buildMigrationLedgerTableSql({ tableName = MIGRATION_LEDGER_TABLE } = {}) {
  const safeTableName = String(tableName || "").trim();

  if (!safeTableName) {
    return [];
  }

  return [
    `CREATE TABLE IF NOT EXISTS ${safeTableName} (`,
    "  id TEXT PRIMARY KEY,",
    "  name TEXT NOT NULL,",
    "  module TEXT NOT NULL DEFAULT 'core',",
    "  status TEXT NOT NULL,",
    "  direction TEXT NOT NULL,",
    "  sql_count INTEGER NOT NULL DEFAULT 0,",
    "  applied_at TIMESTAMPTZ,",
    "  error TEXT,",
    "  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
    "  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    ");",
    `CREATE INDEX IF NOT EXISTS ${safeTableName}_status_idx ON ${safeTableName} (status);`,
    `CREATE INDEX IF NOT EXISTS ${safeTableName}_module_idx ON ${safeTableName} (module);`,
  ];
}

export function buildMigrationLedgerPlan({ tableName = MIGRATION_LEDGER_TABLE } = {}) {
  const sql = buildMigrationLedgerTableSql({ tableName });

  return {
    ok: sql.length > 0,
    type: "migration_ledger_plan",
    mode: "plan_only",
    tableName: String(tableName || "").trim(),
    willMutateDatabase: false,
    sql,
    sqlCount: sql.length,
    rules: {
      noQueryExecution: true,
      noStartupExecution: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
      explicitApprovalRequired: true,
    },
  };
}

export default {
  MIGRATION_LEDGER_TABLE,
  getMigrationLedgerTableName,
  buildMigrationLedgerTableSql,
  buildMigrationLedgerPlan,
};
