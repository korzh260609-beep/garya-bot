// AGENT NOTE:
// SG 2.0 migration DB readiness diagnostics.
// Purpose: verify basic DB connectivity for future manual migration execution using read-only SELECT 1.
// Do not execute migrations, open transactions, write ledger rows, create schema, call AI, touch Telegram, or write Project Memory here.

import { isDatabaseConfigured, queryPostgres } from "../db/postgresClient.js";

export const MIGRATION_DB_READINESS_CHECK_NAME = "migration_db_readiness";
export const MIGRATION_DB_READINESS_CHECK_VERSION = 1;

export async function runMigrationDbReadinessCheck({
  databaseConfigured = isDatabaseConfigured(),
  queryFn = queryPostgres,
} = {}) {
  const dbConfigured = Boolean(databaseConfigured);

  if (!dbConfigured) {
    return {
      ok: false,
      type: "diagnostics_check",
      name: MIGRATION_DB_READINESS_CHECK_NAME,
      version: MIGRATION_DB_READINESS_CHECK_VERSION,
      summary: "Migration DB readiness check skipped: DATABASE_URL is not configured.",
      mode: "read_only_connectivity_check",
      willMutateDatabase: false,
      database: {
        configured: false,
        connectivityChecked: false,
        queryExecuted: false,
        secretExposed: false,
      },
      result: null,
      warnings: [
        {
          code: "database_not_configured",
          message: "DATABASE_URL is not configured; migration DB readiness cannot be verified.",
        },
      ],
      safety: {
        readOnly: true,
        noDbMutation: true,
        noTransactionOpened: true,
        noMigrationExecution: true,
        noSqlMigrationExecution: true,
        noLedgerWrite: true,
        noSchemaCreation: true,
        noStartupExecution: true,
        noTelegramExecution: true,
        noAiExecution: true,
        noProjectMemoryWrite: true,
        secretExposed: false,
      },
    };
  }

  let queryResult;

  try {
    queryResult = await queryFn("SELECT 1 AS ok", []);
  } catch (error) {
    queryResult = {
      ok: false,
      reason: error?.message || "migration_db_readiness_query_failed",
      rows: [],
      rowCount: 0,
    };
  }

  const queryOk = Boolean(queryResult?.ok);

  return {
    ok: queryOk,
    type: "diagnostics_check",
    name: MIGRATION_DB_READINESS_CHECK_NAME,
    version: MIGRATION_DB_READINESS_CHECK_VERSION,
    summary: queryOk
      ? "Migration DB readiness OK: read-only connectivity query completed."
      : "Migration DB readiness failed: read-only connectivity query did not complete.",
    mode: "read_only_connectivity_check",
    willMutateDatabase: false,
    database: {
      configured: true,
      connectivityChecked: true,
      queryExecuted: true,
      secretExposed: false,
    },
    result: {
      ok: queryOk,
      rowCount: Number.isInteger(queryResult?.rowCount) ? queryResult.rowCount : 0,
      reason: queryResult?.reason || null,
    },
    warnings: queryOk
      ? []
      : [
          {
            code: "migration_db_readiness_query_failed",
            message: queryResult?.reason || "Read-only migration DB readiness query failed.",
          },
        ],
    safety: {
      readOnly: true,
      noDbMutation: true,
      noTransactionOpened: true,
      noMigrationExecution: true,
      noSqlMigrationExecution: true,
      noLedgerWrite: true,
      noSchemaCreation: true,
      noStartupExecution: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
      secretExposed: false,
    },
  };
}

export default {
  MIGRATION_DB_READINESS_CHECK_NAME,
  MIGRATION_DB_READINESS_CHECK_VERSION,
  runMigrationDbReadinessCheck,
};
