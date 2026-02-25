// src/db/ensureTables.js
// ✅ 2.9 DB CONSOLIDATION: migrations = single source of truth
// ensureTables = read-only readiness check (NO CREATE TABLE here)

import pool from "../../db.js";

async function assertTableExists(tableName) {
  const res = await pool.query(`SELECT to_regclass($1) AS regclass`, [tableName]);

  const exists = !!res.rows?.[0]?.regclass;
  if (!exists) {
    throw new Error(
      `DB schema not ready: missing table "${tableName}". ` +
        `Apply migrations (temporarily RUN_MIGRATIONS_ON_BOOT=1) and redeploy.`
    );
  }
}

export async function ensureTables() {
  // tables that must exist after migrations (factual readiness, not stage-markers)

  // Core DB
  await assertTableExists("schema_version");
  await assertTableExists("users");
  await assertTableExists("tasks");
  await assertTableExists("interaction_logs");

  // Identity (Stage 4)
  await assertTableExists("user_links");
  await assertTableExists("identity_link_codes");

  // Memory (Stage 7)
  await assertTableExists("chat_memory");
  await assertTableExists("project_memory");
  await assertTableExists("file_intake_logs");

  // Observability (Stage 5)
  await assertTableExists("task_runs");
  await assertTableExists("source_runs");
  await assertTableExists("error_events");
  await assertTableExists("behavior_events");

  // Sources (Stage 10 base tables may already exist in your schema)
  await assertTableExists("sources");
  await assertTableExists("source_cache");
  await assertTableExists("source_checks");
  await assertTableExists("source_logs");

  // Chat History registry (Stage 7B)
  await assertTableExists("chat_messages");
  await assertTableExists("chat_meta");
}
