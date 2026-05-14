// src/diagnostics/projectMemoryLiveDbCheck.js
// SG 2.0 — Project Memory live DB diagnostics check.
// Purpose: verify Project Memory storage tables/indexes/constraints through read-only DB metadata queries.
// Do not add Telegram logic, AI calls, memory writes, schema creation, migrations, candidate confirmation, source sync, or raw secret output here.

import { isDatabaseConfigured, queryPostgres } from "../db/postgresClient.js";
import { PROJECT_MEMORY_TABLES } from "../memory/index.js";

export const PROJECT_MEMORY_LIVE_DB_CHECK_VERSION = 1;

const EXPECTED_TABLES = Object.freeze([
  PROJECT_MEMORY_TABLES.ENTRIES,
  PROJECT_MEMORY_TABLES.WRITE_AUDIT,
]);

const EXPECTED_INDEXES = Object.freeze([
  "sg_project_memory_entries_project_status_idx",
  "sg_project_memory_entries_scope_idx",
  "sg_project_memory_entries_source_idx",
  "sg_project_memory_write_audit_entry_idx",
]);

const EXPECTED_CONSTRAINTS = Object.freeze([
  "sg_project_memory_entries_pkey",
  "sg_project_memory_entries_trust_check",
  "sg_project_memory_entries_status_check",
  "sg_project_memory_write_audit_pkey",
]);

function rowsToNameSet(result = {}, key = "name") {
  return new Set((result.rows || []).map((row) => row?.[key]).filter(Boolean));
}

function findMissing(expected = [], foundSet = new Set()) {
  return expected.filter((item) => !foundSet.has(item));
}

function buildWarnings({ databaseConfigured, tableMissing = [], indexMissing = [], constraintMissing = [] } = {}) {
  const warnings = [];

  if (!databaseConfigured) {
    warnings.push({
      code: "database_not_configured",
      message: "DATABASE_URL is not configured; Project Memory live DB state cannot be verified.",
    });
    return warnings;
  }

  if (tableMissing.length) {
    warnings.push({
      code: "project_memory_tables_missing",
      message: "One or more Project Memory tables are missing in live DB metadata.",
      missing: tableMissing,
    });
  }

  if (indexMissing.length) {
    warnings.push({
      code: "project_memory_indexes_missing",
      message: "One or more Project Memory indexes are missing in live DB metadata.",
      missing: indexMissing,
    });
  }

  if (constraintMissing.length) {
    warnings.push({
      code: "project_memory_constraints_missing",
      message: "One or more Project Memory constraints are missing in live DB metadata.",
      missing: constraintMissing,
    });
  }

  return warnings;
}

async function readTableMetadata() {
  return queryPostgres(
    `SELECT tablename AS name
     FROM pg_catalog.pg_tables
     WHERE schemaname = 'public'
       AND tablename = ANY($1::text[])
     ORDER BY tablename`,
    [EXPECTED_TABLES],
  );
}

async function readIndexMetadata() {
  return queryPostgres(
    `SELECT indexname AS name
     FROM pg_catalog.pg_indexes
     WHERE schemaname = 'public'
       AND indexname = ANY($1::text[])
     ORDER BY indexname`,
    [EXPECTED_INDEXES],
  );
}

async function readConstraintMetadata() {
  return queryPostgres(
    `SELECT constraint_name AS name
     FROM information_schema.table_constraints
     WHERE table_schema = 'public'
       AND constraint_name = ANY($1::text[])
     ORDER BY constraint_name`,
    [EXPECTED_CONSTRAINTS],
  );
}

export async function runProjectMemoryLiveDbCheck() {
  const databaseConfigured = isDatabaseConfigured();

  if (!databaseConfigured) {
    return {
      ok: false,
      type: "project_memory_live_db_check",
      version: PROJECT_MEMORY_LIVE_DB_CHECK_VERSION,
      summary: "Project Memory live DB check skipped: DATABASE_URL is not configured.",
      details: {
        databaseConfigured: false,
        checked: false,
        expectedTables: EXPECTED_TABLES,
        expectedIndexes: EXPECTED_INDEXES,
        expectedConstraints: EXPECTED_CONSTRAINTS,
        foundTables: [],
        foundIndexes: [],
        foundConstraints: [],
        missingTables: EXPECTED_TABLES,
        missingIndexes: EXPECTED_INDEXES,
        missingConstraints: EXPECTED_CONSTRAINTS,
      },
      warnings: buildWarnings({ databaseConfigured: false }),
      sanitized: true,
      readOnly: true,
    };
  }

  const tableResult = await readTableMetadata();
  if (!tableResult.ok) {
    return {
      ok: false,
      type: "project_memory_live_db_check",
      version: PROJECT_MEMORY_LIVE_DB_CHECK_VERSION,
      summary: "Project Memory live DB table metadata query failed.",
      details: {
        databaseConfigured: true,
        checked: false,
        failedStep: "tables",
      },
      warnings: [{
        code: "project_memory_table_metadata_query_failed",
        message: tableResult.reason || "Project Memory table metadata query failed.",
      }],
      sanitized: true,
      readOnly: true,
    };
  }

  const indexResult = await readIndexMetadata();
  if (!indexResult.ok) {
    return {
      ok: false,
      type: "project_memory_live_db_check",
      version: PROJECT_MEMORY_LIVE_DB_CHECK_VERSION,
      summary: "Project Memory live DB index metadata query failed.",
      details: {
        databaseConfigured: true,
        checked: false,
        failedStep: "indexes",
      },
      warnings: [{
        code: "project_memory_index_metadata_query_failed",
        message: indexResult.reason || "Project Memory index metadata query failed.",
      }],
      sanitized: true,
      readOnly: true,
    };
  }

  const constraintResult = await readConstraintMetadata();
  if (!constraintResult.ok) {
    return {
      ok: false,
      type: "project_memory_live_db_check",
      version: PROJECT_MEMORY_LIVE_DB_CHECK_VERSION,
      summary: "Project Memory live DB constraint metadata query failed.",
      details: {
        databaseConfigured: true,
        checked: false,
        failedStep: "constraints",
      },
      warnings: [{
        code: "project_memory_constraint_metadata_query_failed",
        message: constraintResult.reason || "Project Memory constraint metadata query failed.",
      }],
      sanitized: true,
      readOnly: true,
    };
  }

  const foundTablesSet = rowsToNameSet(tableResult);
  const foundIndexesSet = rowsToNameSet(indexResult);
  const foundConstraintsSet = rowsToNameSet(constraintResult);

  const missingTables = findMissing(EXPECTED_TABLES, foundTablesSet);
  const missingIndexes = findMissing(EXPECTED_INDEXES, foundIndexesSet);
  const missingConstraints = findMissing(EXPECTED_CONSTRAINTS, foundConstraintsSet);
  const warnings = buildWarnings({
    databaseConfigured: true,
    tableMissing: missingTables,
    indexMissing: missingIndexes,
    constraintMissing: missingConstraints,
  });
  const ok = warnings.length === 0;

  return {
    ok,
    type: "project_memory_live_db_check",
    version: PROJECT_MEMORY_LIVE_DB_CHECK_VERSION,
    summary: ok
      ? "Project Memory live DB metadata OK."
      : "Project Memory live DB metadata needs attention.",
    details: {
      databaseConfigured: true,
      checked: true,
      expectedTables: EXPECTED_TABLES,
      expectedIndexes: EXPECTED_INDEXES,
      expectedConstraints: EXPECTED_CONSTRAINTS,
      foundTables: [...foundTablesSet],
      foundIndexes: [...foundIndexesSet],
      foundConstraints: [...foundConstraintsSet],
      missingTables,
      missingIndexes,
      missingConstraints,
    },
    warnings,
    sanitized: true,
    readOnly: true,
  };
}

export default {
  runProjectMemoryLiveDbCheck,
};
