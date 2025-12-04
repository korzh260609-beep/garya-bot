// projectMemory.js — сервис для работы с долговременной памятью проекта GARYA AI
import pool from "./db.js";

const DEFAULT_PROJECT_KEY = "garya_ai";

/**
 * Получить одну актуальную запись проектной памяти по project_key + section.
 * Например: section = 'roadmap', 'workflow', 'tz', 'notes'
 */
export async function getProjectSection(projectKey = DEFAULT_PROJECT_KEY, section) {
  if (!section) {
    throw new Error("getProjectSection: section is required");
  }

  const res = await pool.query(
    `
      SELECT id, project_key, section, title, content, tags, meta, schema_version, created_at, updated_at
      FROM project_memory
      WHERE project_key = $1 AND section = $2
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [projectKey, section]
  );

  if (res.rows.length === 0) return null;
  return res.rows[0];
}

/**
 * Получить все записи для проекта (опционально отфильтровав по section).
 * Это пригодится позже для отладки и dashboard'а.
 */
export async function getProjectMemoryList(projectKey = DEFAULT_PROJECT_KEY, section = null) {
  const params = [projectKey];
  let where = "project_key = $1";

  if (section) {
    params.push(section);
    where += " AND section = $2";
  }

  const res = await pool.query(
    `
      SELECT id, project_key, section, title, content, tags, meta, schema_version, created_at, updated_at
      FROM project_memory
      WHERE ${where}
      ORDER BY created_at ASC
    `,
    params
  );

  return res.rows;
}

/**
 * Upsert одной секции проектной памяти:
 * - если уже есть запись для (project_key, section) — обновляем последнюю
 * - если нет — создаём новую.
 *
 * Это удобно для хранения "текущей версии" roadmap/workflow/ТЗ.
 */
export async function upsertProjectSection({
  projectKey = DEFAULT_PROJECT_KEY,
  section,
  title = null,
  content,
  tags = [],
  meta = {},
  schemaVersion = 1,
}) {
  if (!section) {
    throw new Error("upsertProjectSection: section is required");
  }
  if (!content || !content.trim()) {
    throw new Error("upsertProjectSection: content is required");
  }

  // Ищем последнюю запись по этой секции
  const existingRes = await pool.query(
    `
      SELECT id
      FROM project_memory
      WHERE project_key = $1 AND section = $2
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [projectKey, section]
  );

  if (existingRes.rows.length === 0) {
    // Нет записи — создаём новую
    const insertRes = await pool.query(
      `
        INSERT INTO project_memory
          (project_key, section, title, content, tags, meta, schema_version, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, project_key, section, title, content, tags, meta, schema_version, created_at, updated_at
      `,
      [projectKey, section, title, content, tags, meta, schemaVersion]
    );

    return insertRes.rows[0];
  } else {
    // Есть запись — обновляем последнюю
    const id = existingRes.rows[0].id;

    const updateRes = await pool.query(
      `
        UPDATE project_memory
        SET
          title = $1,
          content = $2,
          tags = $3,
          meta = $4,
          schema_version = $5,
          updated_at = NOW()
        WHERE id = $6
        RETURNING id, project_key, section, title, content, tags, meta, schema_version, created_at, updated_at
      `,
      [title, content, tags, meta, schemaVersion, id]
    );

    return updateRes.rows[0];
  }
}
