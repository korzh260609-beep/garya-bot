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

// ✅ Stage 3.6 — Config hygiene (no direct process.env here)
import { envStr, envIntRange } from "../core/config.js";

// ✅ STAGE 7A.4 — Auto-restore seed
import { autoRestoreProjectMemory } from "./projectMemoryAutoRestore.js";

// ✅ add-only helper (now via envStr)
function envTrue(name, def = "false") {
  return envStr(name, def).trim().toLowerCase() === "true";
}

export async function initSystem({ bot }) {
  // ✅ Run diagnostics once on boot/deploy (do not loop)
  try {
    await runDiagnostics({
      rootDir: process.cwd(),
      pool,
      monarchUserId: envStr("MONARCH_USER_ID", "").trim(),
      monarchGlobalUserId: envStr("MONARCH_GLOBAL_USER_ID", "").trim(),
    });
  } catch (e) {
    console.error("❌ BOOT DIAGNOSTICS FAILED:", e);
  }

  // ✅ Run migrations ONLY if enabled by ENV
  await runMigrationsIfEnabled();

  await ensureTables();
  console.log("🧠 Project Memory table OK.");
  console.log("🧾 File-Intake logs table OK.");

  // ✅ STAGE 7A.4 — Auto-restore ROADMAP/WORKFLOW into DB if missing
  try {
    const enabled = envTrue("PROJECT_MEMORY_AUTO_RESTORE", "true");
    const r = await autoRestoreProjectMemory({ enabled });
    if (r?.skipped) {
      console.log("🧩 Project Memory auto-restore: skipped");
    } else {
      console.log("🧩 Project Memory auto-restore:", r?.results || r);
    }
  } catch (e) {
    console.error("⚠️ Project Memory auto-restore failed:", e?.message || e);
  }

  // ==========================================================================
  // STAGE 5.x — error_events retention
  // CLEAN MODE:
  // - Retention is handled by ErrorEventsRetentionService (robot loop) with cooldown.
  // - Boot purge is disabled by default to avoid duplication.
  //
  // To manually re-enable boot purge (NOT recommended):
  //   ERROR_EVENTS_BOOT_PURGE_ENABLED=true
  // ==========================================================================

  const bootPurgeEnabled = envTrue("ERROR_EVENTS_BOOT_PURGE_ENABLED", "false");

  if (bootPurgeEnabled) {
    const retentionDays = envIntRange("ERROR_EVENTS_RETENTION_DAYS", 7, {
      min: 1,
      max: 3650,
    });

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
        `🧹 error_events boot cleanup: deleted ${r?.rowCount || 0} rows (scope=runtime, older than ${retentionDays}d)`
      );
    } catch (e) {
      console.error("⚠️ error_events boot cleanup failed:", e?.message || e);
    }
  } else {
    console.log("🧼 error_events boot cleanup: skipped (retention handled by service)");
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