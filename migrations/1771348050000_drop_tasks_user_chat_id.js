// migrations/1771348050000_drop_tasks_user_chat_id.js
// FINAL legacy cleanup: drop tasks.user_chat_id (identity-first Stage 4)

export const shorthands = undefined;

export async function up(pgm) {
  pgm.dropColumn("tasks", "user_chat_id", { ifExists: true });
}

export async function down(pgm) {
  // rollback only if реально нужен
  pgm.addColumn(
    "tasks",
    {
      user_chat_id: { type: "text" },
    },
    { ifNotExists: true }
  );
}
