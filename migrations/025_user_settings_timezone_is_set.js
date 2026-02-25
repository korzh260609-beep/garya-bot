// migrations/025_user_settings_timezone_is_set.js

export async function up(pgm) {
  pgm.addColumn("user_settings", {
    timezone_is_set: { type: "boolean", notNull: true, default: false },
  });

  pgm.createIndex("user_settings", ["timezone_is_set"]);
}

export async function down(pgm) {
  pgm.dropIndex("user_settings", ["timezone_is_set"]);
  pgm.dropColumn("user_settings", "timezone_is_set");
}
