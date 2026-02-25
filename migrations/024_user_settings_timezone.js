// migrations/024_user_settings_timezone.js

export async function up(pgm) {
  pgm.createTable("user_settings", {
    global_user_id: { type: "text", primaryKey: true },
    timezone: { type: "text", notNull: true, default: "UTC" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createIndex("user_settings", ["timezone"]);
}

export async function down(pgm) {
  pgm.dropTable("user_settings");
}
