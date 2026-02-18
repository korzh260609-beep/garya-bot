// src/bootstrap/initSystem.js

import pool from "../../db.js";

import { ensureDefaultSources } from "../sources/sources.js";
import { startRobotLoop } from "../robot/robotMock.js";
import * as AccessRequests from "../users/accessRequests.js";

// ✅ BOOT DIAGNOSTICS (runs once on deploy/start)
import { runDiagnostics } from "../../diagnostics/diagnostics.js";

// ✅ DB init must live in db-layer (avoid CORE_BOUNDARY_VIOLATION)
import { ensureTables } from "../db/ensureTables.js";

// ✅ DB migrations (optional, env-gated)
import { runMigrationsIfEnabled } from "../db/runMigrations.js";

export async function initSystem({ bot }) {
  // ✅ Run diagnostics once on boot/deploy (do not loop)
  try {
    await runDiagnostics({
      rootDir: process.cwd(),
      pool,
      monarchUserId: String(process.env.MONARCH_USER_ID || "").trim(),
    });
  } catch (e) {
    console.error("❌ BOOT DIAGNOSTICS FAILED:", e);
  }

  // ✅ Run migrations ONLY if enabled by ENV
  await runMigrationsIfEnabled();

  await ensureTables();
  console.log("🧠 Project Memory table OK.");
  console.log("🧾 File-Intake logs table OK.");

  // ✅ Stage 5.x maintenance: auto-clean old runtime error events
  // Default: keep 7 days. Only scope=runtime (do NOT delete task/source errors)
  const retentionDaysRaw = Number(process.env.ERROR_EVENTS_RETENTION_DAYS || 7);
  const retentionDays = Number.isFinite(retentionDaysRaw)
    ? Math.max(1, Math.floor(retentionDaysRaw))
    : 7;

  try {
    const r = await pool.query(
      `
      DELETE FROM error_events
      WHERE scope = 'runtime'
        AND created_at < NOW() - ($1::interval)
      `,
      [`${retentionDays} days`]
    );

    console.log(
      `🧹 error_events cleanup: deleted ${r?.rowCount || 0} rows (scope=runtime, older than ${retentionDays}d)`
    );
  } catch (e) {
    // must never crash boot
    console.error("⚠️ error_events cleanup failed:", e?.message || e);
  }

  // access_requests (если модуль существует)
  if (typeof AccessRequests.ensureAccessRequestsTable === "function") {
    await AccessRequests.ensureAccessRequestsTable();
    console.log("🛡️ Access Requests table OK.");
  } else {
    console.log("⚠️ AccessRequests.ensureAccessRequestsTable() not found (skip).");
  }

  await ensureDefaultSources();
  console.log("📡 Sources registry готов.");

  startRobotLoop(bot);
  console.log("🤖 ROBOT mock-layer запущен.");
}
