// migrations/1771348400000_error_events_skeleton.js

export async function up(pgm) {
  pgm.createTable(
    "error_events",
    {
      id: "bigserial",
      created_at: {
        type: "timestamptz",
        notNull: true,
        default: pgm.func("now()"),
      },

      scope: {
        type: "text",
        notNull: true, // "task" | "source" | "runtime"
      },

      scope_id: {
        type: "bigint",
      },

      event_type: {
        type: "text",
        notNull: true,
      },

      severity: {
        type: "text",
        notNull: true,
        default: "error", // info | warn | error | fatal
      },

      message: {
        type: "text",
        notNull: true,
      },

      context: {
        type: "jsonb",
        notNull: true,
        default: pgm.func("'{}'::jsonb"),
      },
    },
    { ifNotExists: true }
  );

  pgm.createIndex("error_events", ["created_at"], { ifNotExists: true });
  pgm.createIndex("error_events", ["event_type"], { ifNotExists: true });
  pgm.createIndex("error_events", ["scope", "created_at"], { ifNotExists: true });

  pgm.sql(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_error_events_severity'
  ) THEN
    ALTER TABLE error_events
      ADD CONSTRAINT ck_error_events_severity
      CHECK (severity IN ('info','warn','error','fatal'));
  END IF;
END $$;
  `);
}

export async function down() {
  // forward-only policy
}
