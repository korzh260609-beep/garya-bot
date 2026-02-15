// src/jobs/executionLock.js
// 2.8 EXECUTION SAFETY (SKELETON)
// Advisory lock via PostgreSQL to prevent double execution

import pool from "../../db.js";

const LOCK_KEY = 777001; // arbitrary project lock id

export async function acquireExecutionLock() {
  try {
    const result = await pool.query(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [LOCK_KEY]
    );

    return result.rows[0]?.locked === true;
  } catch (e) {
    console.error("❌ acquireExecutionLock error:", e);
    return false;
  }
}

export async function releaseExecutionLock() {
  try {
    await pool.query(
      "SELECT pg_advisory_unlock($1)",
      [LOCK_KEY]
    );
  } catch (e) {
    console.error("❌ releaseExecutionLock error:", e);
  }
}
