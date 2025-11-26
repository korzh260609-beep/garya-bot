// db.js
import pkg from "pg";
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL is missing!");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // важно для Render Postgres
  },
});

// === СКЕЛЕТ ПАМЯТИ: создаём таблицу chat_memory, если её ещё нет ===
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_memory (
        id SERIAL PRIMARY KEY,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,       -- 'user' или 'assistant'
        content TEXT NOT NULL,    -- текст сообщения
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log("✅ chat_memory table is ready");
  } catch (err) {
    console.error("❌ Error initializing database:", err);
  }
}

initDb();

export default pool;
