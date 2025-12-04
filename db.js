// db.js — подключение к PostgreSQL + инициализация таблиц
import pkg from "pg";
const { Pool } = pkg;

// Проверяем, что задали DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is missing!");
  console.error(
    "Убедись, что переменная окружения DATABASE_URL задана в Render (Settings → Environment)."
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // для Render
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
        type TEXT NOT NULL,                 -- тип: manual / price_monitor / news_monitor / ...
        payload JSONB NOT NULL,             -- параметры задачи (универсально, под любой проект)
        schedule TEXT,                      -- строка расписания (cron/описание)
        status TEXT DEFAULT 'active',       -- active / paused / done / error / deleted
        last_run TIMESTAMPTZ,               -- когда последний раз выполнялась
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // === Таблица источников данных (Sources Layer) — скелет, без привязки к крипте ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sources (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,              -- короткий код источника: 'news_global', 'weather_api', 'crypto_price'
        name TEXT NOT NULL,                    -- человекочитаемое имя
        type TEXT NOT NULL,                    -- 'rss', 'http_json', 'html', 'custom', ...
        url TEXT,                              -- основной URL (если есть)
        enabled BOOLEAN NOT NULL DEFAULT TRUE, -- включён / выключен
        config JSONB DEFAULT '{}'::jsonb,      -- параметры, фильтры и т.п.
        last_success_at TIMESTAMPTZ,
        last_error_at TIMESTAMPTZ,
        last_error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // === Логи запросов к источникам (Sources Layer) ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS source_logs (
        id SERIAL PRIMARY KEY,
        source_key TEXT NOT NULL,          -- ключ источника из таблицы sources
        source_type TEXT,                  -- тип источника (html/rss/coingecko/virtual)
        http_status INTEGER,               -- HTTP статус (если есть)
        ok BOOLEAN DEFAULT false,          -- успешно или нет
        duration_ms INTEGER,               -- длительность запроса в миллисекундах
        params JSONB,                      -- параметры запроса (tickers, url и т.п.)
        extra JSONB,                       -- сырые ошибки, ответы, служебные данные
        created_at TIMESTAMPTZ DEFAULT NOW()
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

    // === Таблица Project Memory (долговременная память проекта GARYA AI) ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_memory (
        id SERIAL PRIMARY KEY,
        project_key TEXT NOT NULL,         -- например: 'garya_ai'
        section TEXT NOT NULL,             -- 'roadmap' | 'workflow' | 'tz' | 'notes' ...
        title TEXT,                        -- короткий заголовок записи
        content TEXT NOT NULL,             -- основной текст (markdown/обычный текст)
        tags TEXT[] DEFAULT '{}',          -- теги для фильтрации
        meta JSONB DEFAULT '{}'::jsonb,    -- произвольные доп. данные
        schema_version INTEGER DEFAULT 1,  -- версия схемы project memory
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Индекс для быстрых запросов по проекту и секции
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_project_memory_project_section
      ON project_memory (project_key, section);
    `);

    console.log(
      "✅ Tables ready: chat_memory, users, tasks, sources, source_logs, interaction_logs, project_memory"
    );
  } catch (err) {
    console.error("❌ Error initializing database:", err);
  }
}

// Инициализируем таблицы один раз при старте сервиса
initDb();

export default pool;
