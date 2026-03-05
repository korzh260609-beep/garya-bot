// migrations/022_chat_history_retention_policy_skeleton.js
// STAGE 7B — CHAT HISTORY RETENTION POLICY
//
// Эта миграция создаёт таблицу chat_history_retention_policy.
// Таблица хранит правила retention для истории сообщений.
//
// Enforcement выполняется сервисом:
//
//   src/core/retention/ChatHistoryRetentionService.js
//
// Сервис вызывается из robotTick() и выполняет:
// - batch deletion
// - cooldown protection
// - fail-safe поведение
//
// Таким образом:
// DB хранит policy,
// а удаление выполняет сервис.

export async function up(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_history_retention_policy (
      id SERIAL PRIMARY KEY,

      role TEXT NOT NULL,
      retention_days INTEGER,

      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // базовые политики
  await pool.query(`
    INSERT INTO chat_history_retention_policy (role, retention_days)
    VALUES
      ('guest', 30),
      ('citizen', 90),
      ('monarch', NULL)
    ON CONFLICT DO NOTHING;
  `);
}

export async function down(pool) {
  await pool.query(`
    DROP TABLE IF EXISTS chat_history_retention_policy;
  `);
}