import pool from "./db.js";

/**
 * СКЕЛЕТ слоя источников (Sources Layer)
 * ----------------------------------------------------
 * Сейчас здесь только одна функция — listSources().
 * Позже мы добавим:
 *  - registerSource() — запись нового источника в БД
 *  - updateSource() — изменение параметров
 *  - deleteSource()
 *  - fetchFromSource() — универсальная обёртка для RSS/API/Web
 * Но пока — минимальный рабочий модуль.
 */

/** Получение последних записей из таблицы sources */
export async function listSources(limit = 50) {
  try {
    const res = await pool.query(
      `
        SELECT id, name, type, config, created_at
        FROM sources
        ORDER BY id DESC
        LIMIT $1
      `,
      [limit]
    );

    return res.rows;
  } catch (err) {
    console.error("❌ listSources DB error:", err);
    return [];
  }
}

/**
 * Заглушка под будущее — регистрация нового источника
 * Чтобы код других модулей не падал, возвращаем null.
 */
export async function registerSource() {
  console.log("ℹ️ registerSource(): пока заглушка (ЭТАП 3)");
  return null;
}

/**
 * Заглушка под будущее — обновление источника
 */
export async function updateSource() {
  console.log("ℹ️ updateSource(): пока заглушка (ЭТАП 3)");
  return null;
}

/**
 * Заглушка под будущее — удаление источника
 */
export async function deleteSource() {
  console.log("ℹ️ deleteSource(): пока заглушка (ЭТАП 3)");
  return null;
}
