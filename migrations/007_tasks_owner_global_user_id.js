// migrations/007_tasks_owner_global_user_id.js
// STAGE 4.x — Task ownership identity-first (skeleton)
// Add tasks.user_global_id (TEXT) to support ownership by global_user_id.
// Keep legacy tasks.user_chat_id for backward compatibility (temporary).

export async function up(pgm) {
  // 1) Add new column (nullable — безопасный rollout)
  pgm.addColumn("tasks", {
    user_global_id: { type: "text" },
  });

  // 2) Index for performance
  pgm.createIndex("tasks", ["user_global_id"], {
    name: "idx_tasks_user_global_id",
    ifNotExists: true,
  });
}

export async function down(pgm) {
  // Forward-only policy, rollback формально оставляем
  pgm.dropIndex("tasks", ["user_global_id"], {
    name: "idx_tasks_user_global_id",
    ifExists: true,
  });

  pgm.dropColumn("tasks", "user_global_id", { ifExists: true });
}
