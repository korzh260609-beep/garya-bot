// db.js — подключение к PostgreSQL + инициализация таблиц
import pkg from "pg";
const { Pool } = pkg;

// Проверяем, что задан DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is missing!");
  console.error(
    "Убедись, что переменная окружения DATABASE_URL задана (Render / .env)."
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
        name TEXT,
        role TEXT DEFAULT 'guest',
        language TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // === Таблица задач (Task Engine) ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_chat_id TEXT NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        payload JSONB NOT NULL,
        schedule TEXT,
        status TEXT DEFAULT 'active',
        last_run TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

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
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // === Мягкая миграция enabled → is_enabled (на случай старой схемы) ===
    try {
      await pool.query(`
        ALTER TABLE sources
        RENAME COLUMN enabled TO is_enabled;
      `);
      console.log("🔧 Migrate: sources.enabled -> sources.is_enabled");
    } catch (e) {
      // колонка enabled уже отсутствует — значит, миграция не нужна
    }

    // === Таблица проверок источников (Diagnostics) ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS source_checks (
        id SERIAL PRIMARY KEY,
        source_key TEXT NOT NULL,
        ok BOOLEAN NOT NULL,
        http_status INT,
        message TEXT,
        meta JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // === Логи запросов к источникам ===
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

    // === Таблица Project Memory ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_memory (
        id SERIAL PRIMARY KEY,
        project_key TEXT NOT NULL,
        section TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        tags TEXT[] DEFAULT '{}'::text[],
        meta JSONB DEFAULT '{}'::jsonb,
        schema_version INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Индекс для быстрых выборок по project_key + section
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_project_memory_project_section
      ON project_memory (project_key, section);
    `);

    console.log(
      "✅ Tables ready: chat_memory, users, tasks, sources, source_checks, source_logs, interaction_logs, project_memory"
    );
  } catch (err) {
    console.error("❌ Error initializing database:", err);
  }
}

// Инициализация таблиц при старте
initDb();

export default pool;
