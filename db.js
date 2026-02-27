// db.js — подключение к PostgreSQL + инициализация таблиц
import pkg from "pg";
const { Pool } = pkg;

// ✅ Stage 3.6 — Config hygiene (no direct process.env here)
import { envStr } from "./src/core/config.js";

// Проверяем, что задан DATABASE_URL
const DATABASE_URL = envStr("DATABASE_URL", "").trim();
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is missing!");
  console.error(
    "Убедись, что переменная окружения DATABASE_URL задана (Render / .env)."
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // для Render и других хостингов с SSL
  },
});

async function initDb() {
  try {
    // === Таблица памяти диалога ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_memory (
        id SERIAL PRIMARY KEY,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // === Таблица профилей пользователей ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        chat_id TEXT UNIQUE NOT NULL,
        tg_user_id TEXT,
        name TEXT,
        role TEXT DEFAULT 'guest',
        language TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // --- Safe migration: add tg_user_id if missing ---
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS tg_user_id TEXT;
    `);

    // === Таблица задач (Task Engine) — identity-only ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_global_id TEXT NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        payload JSONB NOT NULL,
        schedule TEXT,
        status TEXT DEFAULT 'active',
        last_run TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // --- Safe migration: ensure tasks.user_global_id exists (fix old prod DB) ---
    await pool.query(`
      ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS user_global_id TEXT;
    `);

    // --- Optional backfill: if legacy tasks.user_chat_id exists, copy it to user_global_id ---
    try {
      await pool.query(`
        UPDATE tasks
        SET user_global_id = user_chat_id
        WHERE (user_global_id IS NULL OR user_global_id = '')
          AND user_chat_id IS NOT NULL
          AND user_chat_id <> '';
      `);
    } catch (e) {
      // ignore (legacy column may not exist)
    }

    // === Таблица источников данных ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sources (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        config JSONB DEFAULT '{}'::jsonb,
        last_success_at TIMESTAMPTZ,
        last_error_at TIMESTAMPTZ,
        last_error_message TEXT,
        allowed_roles TEXT[] DEFAULT '{guest,citizen,monarch}',
        allowed_plans TEXT[] DEFAULT '{free,pro,vip}',
        rate_limit_seconds INTEGER DEFAULT 10,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // === Мягкие миграции sources ===
    try {
      await pool.query(`
        ALTER TABLE sources
        RENAME COLUMN enabled TO is_enabled;
      `);
    } catch (e) {
      // ignore
    }

    try {
      await pool.query(`
        ALTER TABLE sources
        ADD COLUMN IF NOT EXISTS allowed_roles TEXT[] DEFAULT '{guest,citizen,monarch}';
      `);
    } catch (e) {
      // ignore
    }

    try {
      await pool.query(`
        ALTER TABLE sources
        ADD COLUMN IF NOT EXISTS allowed_plans TEXT[] DEFAULT '{free,pro,vip}';
      `);
    } catch (e) {
      // ignore
    }

    try {
      await pool.query(`
        ALTER TABLE sources
        ADD COLUMN IF NOT EXISTS rate_limit_seconds INTEGER DEFAULT 10;
      `);
    } catch (e) {
      // ignore
    }

    // === Таблица кэша источников ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS source_cache (
        id SERIAL PRIMARY KEY,
        source_key TEXT NOT NULL UNIQUE,
        cached_json JSONB NOT NULL,
        cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_source_cache_source_key
      ON source_cache (source_key);
    `);

    // === Diagnostics: source_checks ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS source_checks (
        id SERIAL PRIMARY KEY,
        source_key TEXT NOT NULL,
        status TEXT,
        ok BOOLEAN NOT NULL,
        http_status INT,
        message TEXT,
        meta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_source_checks_source_key_created_at
      ON source_checks (source_key, created_at DESC);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_source_checks_created_at
      ON source_checks (created_at DESC);
    `);

    // === Логи источников ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS source_logs (
        id SERIAL PRIMARY KEY,
        source_key TEXT NOT NULL,
        source_type TEXT,
        http_status INTEGER,
        ok BOOLEAN DEFAULT false,
        duration_ms INTEGER,
        params JSONB,
        extra JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_source_logs_source_key_created_at
      ON source_logs (source_key, created_at DESC);
    `);

    // === Логи взаимодействий с ИИ ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS interaction_logs (
        id SERIAL PRIMARY KEY,
        chat_id TEXT NOT NULL,
        task_type TEXT NOT NULL,
        ai_cost_level TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_interaction_logs_chat_created_at
      ON interaction_logs (chat_id, created_at DESC);
    `);

    // === Repo Index Snapshots ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS repo_index_snapshots (
        id BIGSERIAL PRIMARY KEY,
        repo TEXT NOT NULL,
        branch TEXT NOT NULL,
        commit_sha TEXT,
        stats JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS repo_index_files (
        snapshot_id BIGINT NOT NULL
          REFERENCES repo_index_snapshots(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        blob_sha TEXT,
        size INTEGER DEFAULT 0,
        PRIMARY KEY (snapshot_id, path)
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_repo_index_snapshots_repo_branch
      ON repo_index_snapshots (repo, branch, created_at DESC);
    `);
  } catch (err) {
    console.error("❌ Error initializing database:", err);
  }
}

// Инициализация таблиц при старте
initDb();

export default pool;
