// AGENT NOTE:
// SG 2.0 migration ledger writer boundary.
// Purpose: write migration ledger rows only when an explicit ready decision and injected transaction client are provided.
// Do not import postgresClient, add startup hooks, read env directly, call AI, touch Telegram, or write Project Memory here.

import { MIGRATION_EXECUTION_DECISIONS } from "./migrationExecutionController.js";
import { MIGRATION_LEDGER_TABLE } from "./migrationLedger.js";
import { MIGRATION_DIRECTIONS, MIGRATION_STATUSES } from "./migrationTypes.js";

export const MIGRATION_LEDGER_WRITER_VERSION = 1;

export const MIGRATION_LEDGER_WRITER_REASONS = Object.freeze({
  DECISION_NOT_READY: "migration_decision_not_ready_for_ledger_write",
  CLIENT_REQUIRED: "migration_ledger_transaction_client_required",
  MIGRATION_INVALID: "migration_ledger_migration_invalid",
  STATUS_INVALID: "migration_ledger_status_invalid",
  TABLE_NAME_INVALID: "migration_ledger_table_name_invalid",
});

const VALID_STATUSES = new Set(Object.values(MIGRATION_STATUSES));
const VALID_DIRECTIONS = new Set(Object.values(MIGRATION_DIRECTIONS));

function hasQueryFunction(client) {
  return Boolean(client && typeof client.query === "function");
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeSqlCount(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

export function buildMigrationLedgerWriteRecord({
  migration,
  status = MIGRATION_STATUSES.PENDING,
  direction = MIGRATION_DIRECTIONS.UP,
  error = null,
  appliedAt = null,
} = {}) {
  return {
    id: normalizeString(migration?.id),
    name: normalizeString(migration?.name),
    module: normalizeString(migration?.module) || "core",
    status: normalizeString(status),
    direction: normalizeString(direction),
    sqlCount: Array.isArray(migration?.upSql)
      ? migration.upSql.map((sql) => normalizeString(sql)).filter(Boolean).length
      : normalizeSqlCount(migration?.sqlCount),
    appliedAt,
    error: error ? String(error) : null,
  };
}

export function buildMigrationLedgerUpsertQuery({
  record,
  tableName = MIGRATION_LEDGER_TABLE,
} = {}) {
  const safeTableName = normalizeString(tableName);

  if (!safeTableName) {
    return null;
  }

  return {
    text: [
      `INSERT INTO ${safeTableName} (`,
      "  id, name, module, status, direction, sql_count, applied_at, error, created_at, updated_at",
      ") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())",
      "ON CONFLICT (id) DO UPDATE SET",
      "  name = EXCLUDED.name,",
      "  module = EXCLUDED.module,",
      "  status = EXCLUDED.status,",
      "  direction = EXCLUDED.direction,",
      "  sql_count = EXCLUDED.sql_count,",
      "  applied_at = EXCLUDED.applied_at,",
      "  error = EXCLUDED.error,",
      "  updated_at = NOW()",
      "RETURNING id, name, module, status, direction, sql_count, applied_at, error, created_at, updated_at;",
    ].join("\n"),
    values: [
      record.id,
      record.name,
      record.module,
      record.status,
      record.direction,
      record.sqlCount,
      record.appliedAt,
      record.error,
    ],
  };
}

export function canWriteMigrationLedger({
  decision,
  client,
  record,
  tableName = MIGRATION_LEDGER_TABLE,
} = {}) {
  if (decision?.decision !== MIGRATION_EXECUTION_DECISIONS.READY_FOR_FUTURE_EXECUTION) {
    return {
      ok: false,
      reason: MIGRATION_LEDGER_WRITER_REASONS.DECISION_NOT_READY,
    };
  }

  if (!hasQueryFunction(client)) {
    return {
      ok: false,
      reason: MIGRATION_LEDGER_WRITER_REASONS.CLIENT_REQUIRED,
    };
  }

  if (!normalizeString(tableName)) {
    return {
      ok: false,
      reason: MIGRATION_LEDGER_WRITER_REASONS.TABLE_NAME_INVALID,
    };
  }

  if (!record?.id || !record?.name) {
    return {
      ok: false,
      reason: MIGRATION_LEDGER_WRITER_REASONS.MIGRATION_INVALID,
    };
  }

  if (!VALID_STATUSES.has(record.status) || !VALID_DIRECTIONS.has(record.direction)) {
    return {
      ok: false,
      reason: MIGRATION_LEDGER_WRITER_REASONS.STATUS_INVALID,
    };
  }

  return {
    ok: true,
    reason: "migration_ledger_write_allowed",
  };
}

export async function writeMigrationLedgerRecord({
  decision,
  client,
  migration,
  status = MIGRATION_STATUSES.PENDING,
  direction = MIGRATION_DIRECTIONS.UP,
  error = null,
  appliedAt = null,
  tableName = MIGRATION_LEDGER_TABLE,
} = {}) {
  const record = buildMigrationLedgerWriteRecord({
    migration,
    status,
    direction,
    error,
    appliedAt,
  });
  const allowed = canWriteMigrationLedger({ decision, client, record, tableName });

  if (!allowed.ok) {
    return {
      ok: false,
      type: "migration_ledger_write_result",
      status: "skipped",
      reason: allowed.reason,
      migrationId: record.id,
      migrationName: record.name,
      willMutateDatabase: false,
      rowCount: 0,
      rows: [],
    };
  }

  const query = buildMigrationLedgerUpsertQuery({ record, tableName });
  const result = await client.query(query.text, query.values);

  return {
    ok: true,
    type: "migration_ledger_write_result",
    status: "written",
    reason: "migration_ledger_record_written",
    migrationId: record.id,
    migrationName: record.name,
    willMutateDatabase: true,
    rowCount: result?.rowCount || 0,
    rows: result?.rows || [],
  };
}

export default {
  MIGRATION_LEDGER_WRITER_VERSION,
  MIGRATION_LEDGER_WRITER_REASONS,
  buildMigrationLedgerWriteRecord,
  buildMigrationLedgerUpsertQuery,
  canWriteMigrationLedger,
  writeMigrationLedgerRecord,
};
