import pool from "./db.js";

// Источники: пока только чтение таблицы sources
export async function listSources(limit = 50) {
  const res = await pool.query(
    `
      SELECT *
      FROM sources
      ORDER BY id DESC
      LIMIT $1
    `,
    [limit]
  );

  return res.rows;
}
