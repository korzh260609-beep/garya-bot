// src/bootstrap/initSystem.js

import pool from "../../db.js";

import { ensureDefaultSources } from "../sources/sources.js";
import { startRobotLoop } from "../robot/robotMock.js";
import * as AccessRequests from "../users/accessRequests.js";

async function ensureProjectMemoryTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_memory (
      id BIGSERIAL PRIMARY KEY,
      project_key TEXT NOT NULL,
      section TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      schema_version INT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_project_memory_key_section_created
    ON project_memory (project_key, section, created_at);
  `);
}

async function ensureFileIntakeLogsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS file_intake_logs (
      id BIGSERIAL PRIMARY KEY,
      chat_id TEXT NOT NULL,
      message_id BIGINT,
      kind TEXT,
      file_id TEXT,
      file_unique_id TEXT,
      file_name TEXT,
      mime_type TEXT,
      file_size BIGINT,

      has_text BOOLEAN NOT NULL DEFAULT FALSE,
      should_call_ai BOOLEAN NOT NULL DEFAULT FALSE,
      direct_reply BOOLEAN NOT NULL DEFAULT FALSE,

      processed_text_chars INT NOT NULL DEFAULT 0,

      ai_called BOOLEAN NOT NULL DEFAULT FALSE,
      ai_error BOOLEAN NOT NULL DEFAULT FALSE,

      meta JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_file_intake_logs_chat_created
    ON file_intake_logs (chat_id, created_at DESC);
  `);
}

export async function initSystem({ bot }) {
  await ensureProjectMemoryTable();
  console.log("🧠 Project Memory table OK.");

  await ensureFileIntakeLogsTable();
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
