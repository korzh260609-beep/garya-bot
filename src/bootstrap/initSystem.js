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
      monarchChatId: (process.env.MONARCH_CHAT_ID || "677128443").toString(),
    });
  } catch (e) {
    console.error("❌ BOOT DIAGNOSTICS FAILED:", e);
  }

  // ✅ Run migrations ONLY if enabled by ENV
  await runMigrationsIfEnabled();

  await ensureTables();
  console.log("🧠 Project Memory table OK.");
  console.log("🧾 File-Intake logs table OK.");

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
