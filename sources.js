// sources.js — базовый слой для работы с источниками данных

import pool from "./db.js";

// Получить список источников
export async function getAllSources() {
  const res = await pool.query(`SELECT * FROM sources ORDER BY id ASC`);
  return res.rows;
}

// Добавить новый источник
export async function addSource(key, name, type, url, config = {}) {
  const res = await pool.query(
    `
      INSERT INTO sources (key, name, type, url, config)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `,
    [key, name, type, url, config]
  );
  return res.rows[0];
}

// Обновить источник
export async function updateSource(id, fields) {
  const keys = Object.keys(fields);
  const values = Object.values(fields);

  const setString = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");

  const res = await pool.query(
    `
      UPDATE sources
      SET ${setString}, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `,
    [id, ...values]
  );

  return res.rows[0];
}
