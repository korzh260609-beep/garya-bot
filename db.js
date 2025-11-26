async function initDb() {
  try {
    // Таблица для памяти диалога
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_memory (
        id SERIAL PRIMARY KEY,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Таблица профилей пользователей
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

    console.log("✅ chat_memory & users tables are ready");
  } catch (err) {
    console.error("❌ Error initializing database:", err);
  }
}
