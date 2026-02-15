// migrations/001_schema_version.js

export async function up(pgm) {
  pgm.createTable("schema_version", {
    id: { type: "bigserial", primaryKey: true },
    version: { type: "integer", notNull: true },
    note: { type: "text" },
    applied_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createIndex("schema_version", ["version"], { unique: true });

  // Initial version = 1 (base)
  pgm.sql(
    `INSERT INTO schema_version (version, note)
     VALUES (1, 'init schema_version table')
     ON CONFLICT (version) DO NOTHING;`
  );
}

export async function down(pgm) {
  pgm.dropTable("schema_version");
}
