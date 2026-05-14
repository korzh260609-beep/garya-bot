// AGENT NOTE:
// SG 2.0 migration SQL executor boundary.
// Purpose: execute migration SQL only when an explicit approved decision and injected transaction client are provided.
// Do not import postgresClient, add startup hooks, read env directly, call AI, touch Telegram, or write Project Memory here.

import { MIGRATION_EXECUTION_DECISIONS } from "./migrationExecutionController.js";

export const MIGRATION_SQL_EXECUTOR_VERSION = 1;

export const MIGRATION_SQL_EXECUTOR_REASONS = Object.freeze({
  DECISION_NOT_READY: "migration_decision_not_ready_for_execution",
  CLIENT_REQUIRED: "migration_transaction_client_required",
  MIGRATION_INVALID: "migration_definition_invalid",
  SQL_LIST_EMPTY: "migration_sql_list_empty",
});

function hasQueryFunction(client) {
  return Boolean(client && typeof client.query === "function");
}

function normalizeSqlList(migration = {}) {
  return Array.isArray(migration.upSql)
    ? migration.upSql.map((sql) => String(sql || "").trim()).filter(Boolean)
    : [];
}

export function canExecuteMigrationSql({ decision, client, migration } = {}) {
  const sql = normalizeSqlList(migration);

  if (decision?.decision !== MIGRATION_EXECUTION_DECISIONS.READY_FOR_FUTURE_EXECUTION) {
    return {
      ok: false,
      reason: MIGRATION_SQL_EXECUTOR_REASONS.DECISION_NOT_READY,
      sqlCount: sql.length,
    };
  }

  if (!hasQueryFunction(client)) {
    return {
      ok: false,
      reason: MIGRATION_SQL_EXECUTOR_REASONS.CLIENT_REQUIRED,
      sqlCount: sql.length,
    };
  }

  if (!migration?.id || !migration?.name) {
    return {
      ok: false,
      reason: MIGRATION_SQL_EXECUTOR_REASONS.MIGRATION_INVALID,
      sqlCount: sql.length,
    };
  }

  if (sql.length === 0) {
    return {
      ok: false,
      reason: MIGRATION_SQL_EXECUTOR_REASONS.SQL_LIST_EMPTY,
      sqlCount: sql.length,
    };
  }

  return {
    ok: true,
    reason: "migration_sql_execution_allowed",
    sqlCount: sql.length,
  };
}

export async function executeMigrationSql({ decision, client, migration } = {}) {
  const allowed = canExecuteMigrationSql({ decision, client, migration });
  const sql = normalizeSqlList(migration);

  if (!allowed.ok) {
    return {
      ok: false,
      type: "migration_sql_execution_result",
      status: "skipped",
      reason: allowed.reason,
      migrationId: migration?.id || "",
      migrationName: migration?.name || "",
      sqlCount: allowed.sqlCount,
      executedCount: 0,
      willMutateDatabase: false,
    };
  }

  const executed = [];

  for (const statement of sql) {
    await client.query(statement);
    executed.push({
      index: executed.length,
      executed: true,
    });
  }

  return {
    ok: true,
    type: "migration_sql_execution_result",
    status: "applied",
    reason: "migration_sql_executed",
    migrationId: migration.id,
    migrationName: migration.name,
    sqlCount: sql.length,
    executedCount: executed.length,
    executed,
    willMutateDatabase: true,
  };
}

export default {
  MIGRATION_SQL_EXECUTOR_VERSION,
  MIGRATION_SQL_EXECUTOR_REASONS,
  canExecuteMigrationSql,
  executeMigrationSql,
};
