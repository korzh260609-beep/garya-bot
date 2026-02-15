// migrations/003_task_run_key_unique.js
// 2.8.2 Protection against duplicates via unique task_run_key

export async function up(pgm) {
  // add column task_run_key if not exists
  pgm.addColumn(
    "tasks",
    {
      task_run_key: { type: "text" }
    },
    { ifNotExists: true }
  );

  // ensure unique constraint exists (idempotent; safe if already exists as constraint OR index)
  pgm.sql(`
DO $$
BEGIN
  -- already exists as constraint
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_task_run_key_unique'
  ) THEN
    RETURN;
  END IF;

  -- already exists as index (relation) with same name
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'tasks_task_run_key_unique'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_task_run_key_unique"
    UNIQUE ("task_run_key");
END $$;
  `);

  // record schema version
  pgm.sql(`
    INSERT INTO schema_version (version, note)
    VALUES (3, 'add unique task_run_key for execution safety')
    ON CONFLICT (version) DO NOTHING;
  `);
}

export async function down(pgm) {
  // forward-only policy (prod-safe)
  // keep empty or minimal; DO NOT drop constraints/columns in prod
}
