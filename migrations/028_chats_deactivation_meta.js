// migrations/028_chats_deactivation_meta.js

export const shorthands = undefined;

export async function up(pgm) {
  pgm.addColumns("chats", {
    deactivated_at: { type: "timestamptz" },
    deactivated_by: { type: "text" }, // global_user_id or "system"
    deactivate_reason: { type: "text" },
  });

  pgm.createIndex("chats", ["is_active"]);
  pgm.createIndex("chats", ["deactivated_at"]);
}

export async function down(pgm) {
  pgm.dropIndex("chats", ["deactivated_at"]);
  pgm.dropIndex("chats", ["is_active"]);

  pgm.dropColumns("chats", ["deactivated_at", "deactivated_by", "deactivate_reason"]);
}
