// AGENT NOTE:
// SG 2.0 migration ledger reader boundary skeleton.
// Purpose: expose a read-only boundary for future DB-backed migration pending detection.
// This module may describe or run SELECT-only ledger reads when explicitly injected/allowed.
// Do not create schema, mutate DB, open transactions, execute migrations, call AI, touch Telegram, or write Project Memory here.

import { queryPostgres } from "../postgresClient.js";
import { MIGRATION_LEDGER_TABLE } from "./migrationLedger.js";

export const MIGRATION_LEDGER_READER_VERSION = 1;

export const MIGRATION_LEDGER_READER_REASONS = Object.freeze({
  LIVE_READ_DISABLED: "migration_ledger_live_read_disabled",
  TABLE_NAME_REQUIRED: "migration_ledger_table_name_required",
  SELECT_ONLY_BOUNDARY: "migration_ledger_reader_select_only_boundary",
});

function normalizeLedgerStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function normalizeLedgerRows(rows = []) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => ({
      id: String(row?.id || "").trim(),
      name: row?.name ? String(row.name).trim() : null,
      module: row?.module ? String(row.module).trim() : "core",
      status: normalizeLedgerStatus(row?.status),
      direction: row?.direction ? String(row.direction).trim().toLowerCase() : "up",
      appliedAt: row?.applied_at || row?.appliedAt || null,
    }))
    .filter((row) => row.id);
}

export function buildMigrationLedgerSelectSql({ tableName = MIGRATION_LEDGER_TABLE } = {}) {
  const safeTableName = String(tableName || "").trim();

  if (!safeTableName) {
    return null;
  }

  return [
    "SELECT id, name, module, status, direction, applied_at",
    `FROM ${safeTableName}`,
    "WHERE status = 'applied' AND direction = 'up'",
    "ORDER BY applied_at ASC, id ASC;",
  ].join("\n");
}

export function buildMigrationLedgerReadModel({
  tableName = MIGRATION_LEDGER_TABLE,
  rows = [],
  liveReadAttempted = false,
} = {}) {
  const sql = buildMigrationLedgerSelectSql({ tableName });
  const normalizedRows = normalizeLedgerRows(rows);
  const appliedRows = normalizedRows.filter((row) => row.status === "applied" && row.direction === "up");
  const appliedIds = appliedRows.map((row) => row.id);

  return {
    ok: Boolean(sql),
    type: "migration_ledger_read_model",
    version: MIGRATION_LEDGER_READER_VERSION,
    mode: "select_only_read_model",
    implemented: true,
    tableName: String(tableName || "").trim(),
    liveReadAttempted: Boolean(liveReadAttempted),
    appliedKnown: Array.isArray(rows),
    appliedCount: appliedIds.length,
    appliedIds,
    rows: appliedRows,
    selectSql: sql,
    willMutateDatabase: false,
    safety: {
      selectOnly: true,
      noDbMutation: true,
      noTransactionOpened: true,
      noSqlWriteExecution: true,
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

export async function readMigrationLedgerRows({
  tableName = MIGRATION_LEDGER_TABLE,
  allowLiveRead = false,
  query = queryPostgres,
} = {}) {
  const selectSql = buildMigrationLedgerSelectSql({ tableName });

  if (!selectSql) {
    return {
      ok: false,
      type: "migration_ledger_live_read_result",
      version: MIGRATION_LEDGER_READER_VERSION,
      reason: MIGRATION_LEDGER_READER_REASONS.TABLE_NAME_REQUIRED,
      liveReadAttempted: false,
      rows: [],
      rowCount: 0,
      willMutateDatabase: false,
    };
  }

  if (!allowLiveRead) {
    return {
      ok: true,
      type: "migration_ledger_live_read_result",
      version: MIGRATION_LEDGER_READER_VERSION,
      reason: MIGRATION_LEDGER_READER_REASONS.LIVE_READ_DISABLED,
      liveReadAttempted: false,
      rows: [],
      rowCount: 0,
      selectSql,
      willMutateDatabase: false,
      safety: {
        selectOnly: true,
        noDbMutation: true,
        noTransactionOpened: true,
        noSqlWriteExecution: true,
        noMigrationExecution: true,
        noLedgerWrite: true,
        noSchemaCreation: true,
      },
    };
  }

  const result = await query(selectSql, []);
  const rows = normalizeLedgerRows(result?.rows || []);

  return {
    ok: result?.ok === true,
    type: "migration_ledger_live_read_result",
    version: MIGRATION_LEDGER_READER_VERSION,
    reason: MIGRATION_LEDGER_READER_REASONS.SELECT_ONLY_BOUNDARY,
    liveReadAttempted: true,
    rows,
    rowCount: rows.length,
    selectSql,
    willMutateDatabase: false,
    safety: {
      selectOnly: true,
      noDbMutation: true,
      noTransactionOpened: true,
      noSqlWriteExecution: true,
      noMigrationExecution: true,
      noLedgerWrite: true,
      noSchemaCreation: true,
    },
  };
}

export default {
  MIGRATION_LEDGER_READER_VERSION,
  MIGRATION_LEDGER_READER_REASONS,
  buildMigrationLedgerSelectSql,
  buildMigrationLedgerReadModel,
  readMigrationLedgerRows,
};
