// db.js — PostgreSQL pool ONLY
// IMPORTANT:
// - schema is managed by migrations only
// - no runtime CREATE TABLE / ALTER TABLE here
// - this file must stay minimal and stable

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

// Optional: surface unexpected idle client errors
pool.on("error", (err) => {
  console.error("❌ PostgreSQL pool error:", err);
});

export default pool;