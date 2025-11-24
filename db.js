// db.js
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("⚠ DATABASE_URL is not set");
}

const pool = new Pool({
  connectionString,
  ssl: {
    // Для Render Postgres обычно нужно SSL
    rejectUnauthorized: false,
  },
});

pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL error:", err);
});

// Простая проверка соединения при старте
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Test query to PostgreSQL succeeded");
  } catch (err) {
    console.error("❌ Test query to PostgreSQL failed:", err.message);
  }
})();

export default pool;
