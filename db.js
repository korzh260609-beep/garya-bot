// db.js — подключение к PostgreSQL + инициализация таблиц
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function initDb() {
  try {
    // === Таблица для памяти диалога ===
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

    // === УНИВЕРСАЛЬНАЯ ТАБЛИЦА ЗАДАЧ (Task Engine) ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_chat_id TEXT NOT NULL,         -- для кого задача (любой пользователь)
        title TEXT NOT NULL,                -- короткое имя задачи
        type TEXT NOT NULL,                 -- тип: report / monitor / reminder / fetch / custom
        payload JSONB NOT NULL,             -- параметры задачи (универсально, под любой проект)
        schedule TEXT,                      -- строка расписания (cron/описание)
        status TEXT DEFAULT 'active',       -- active / paused / done / error
        last_run TIMESTAMPTZ,               -- когда последний раз выполнялась
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // === Таблица источников данных (Sources Layer) ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sources (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,              -- короткий код источника: 'news_fed', 'btc_etf', 'binance_btcusdt'
        name TEXT NOT NULL,                    -- человекочитаемое имя
        type TEXT NOT NULL,                    -- 'rss', 'http_json', 'html', 'custom'
        url TEXT,                              -- основной URL (если есть)
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        config JSONB,                          -- параметры, API-ключи, фильтры и т.п.
        last_success_at TIMESTAMPTZ,
        last_error_at TIMESTAMPTZ,
        last_error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // === Лог обращений к ИИ (taskType + aiCostLevel) ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS interaction_logs (
        id SERIAL PRIMARY KEY,
        chat_id TEXT NOT NULL,                 -- чей запрос (ID чата)
        task_type TEXT NOT NULL,               -- chat / report / signal / news / ...
        ai_cost_level TEXT NOT NULL,           -- low / medium / high
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log("✅ chat_memory, users, tasks, sources & interaction_logs tables are ready");
  } catch (err) {
    console.error("❌ Error initializing database:", err);
  }
}

// Инициализируем таблицы один раз при старте сервиса
initDb();

export default pool;
