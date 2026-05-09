// AGENT NOTE:
// SG 2.0 PostgreSQL client boundary.
// Purpose: provide one lazy database client for modules that need durable state.
// Do not add user logic, memory logic, transport logic, migrations orchestration, or AI calls here.

import pg from "pg";
import { envBool, envStr } from "../config/env.js";

const { Pool } = pg;
let pool = null;

export function getDatabaseUrl() {
  return envStr("DATABASE_URL", "").trim();
}

export function isDatabaseConfigured() {
  return Boolean(getDatabaseUrl());
}

export function getPostgresSslConfig() {
  const sslEnabled = envBool("DATABASE_SSL", false);
  return sslEnabled ? { rejectUnauthorized: false } : false;
}

export function getPostgresPool() {
  const connectionString = getDatabaseUrl();

  if (!connectionString) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: getPostgresSslConfig(),
    });
  }

  return pool;
}

export async function queryPostgres(text, params = []) {
  const activePool = getPostgresPool();

  if (!activePool) {
    return {
      ok: false,
      reason: "database_not_configured",
      rows: [],
      rowCount: 0,
    };
  }

  const result = await activePool.query(text, params);

  return {
    ok: true,
    rows: result.rows || [],
    rowCount: result.rowCount || 0,
  };
}
