// migrations/008_backfill_tasks_user_global_id.js
// STAGE 4.x — Backfill tasks.user_global_id from legacy tasks.user_chat_id
// Goal: safely populate user_global_id for existing tasks without breaking prod.
// Strategy:
// 1) If tasks.user_global_id already set -> skip.
// 2) Try map tasks.user_chat_id to users.global_user_id by users.tg_user_id (best-effort).
//    Because in private Telegram chats chat_id == user_id (tg_user_id), but in groups it's NOT.
// 3) (Optional) If you later store other mapping, extend here.
// Notes:
// - Forward-only: does nothing destructive.
// - Safe on re-run: uses WHERE user_global_id IS NULL.
// - If mapping fails, task remains with NULL user_global_id (still usable via legacy user_chat_id until Stage 4.x complete).

export async function up(pgm) {
  // Best-effort backfill using users.tg_user_id (Telegram private chat case)
  pgm.sql(`
    UPDATE tasks t
    SET user_global_id = u.global_user_id
    FROM users u
    WHERE t.user_global_id IS NULL
      AND t.user_chat_id IS NOT NULL
      AND u.tg_user_id IS NOT NULL
      AND u.tg_user_id <> ''
      AND u.global_user_id IS NOT NULL
      AND u.global_user_id <> ''
      AND u.tg_user_id = t.user_chat_id
  `);
}

export async function down(pgm) {
  // Forward-only policy: keep empty rollback
}
