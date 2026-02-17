// migrations/010_drop_tasks_user_chat_id.js

export const shorthands = undefined;

export async function up(pgm) {
  // финальная очистка legacy
  pgm.dropColumn("tasks", "user_chat_id", { ifExists: true });
}

export async function down(pgm) {
  // rollback только если реально нужен
  pgm.addColumn(
    "tasks",
    {
      user_chat_id: { type: "text" },
    },
    { ifNotExists: true }
  );
}
