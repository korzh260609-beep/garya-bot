// src/db/ensureTables.js
// ✅ 2.9 DB CONSOLIDATION: migrations = single source of truth
// ensureTables = read-only readiness check (NO CREATE TABLE here)

import pool from "../../db.js";

async function assertTableExists(tableName) {
  const res = await pool.query(
    `SELECT to_regclass($1) AS regclass`,
    [tableName]
  );

  const exists = !!res.rows?.[0]?.regclass;
  if (!exists) {
    throw new Error(
      `DB schema not ready: missing table "${tableName}". ` +
        `Apply migrations (temporarily RUN_MIGRATIONS_ON_BOOT=1) and redeploy.`
    );
  }
}

export async function ensureTables() {
  // tables that must exist after migrations
  await assertTableExists("schema_version");
  await assertTableExists("project_memory");
  await assertTableExists("file_intake_logs");
}
