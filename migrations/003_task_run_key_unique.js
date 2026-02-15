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

  // unique constraint to prevent duplicates
  pgm.addConstraint(
    "tasks",
    "tasks_task_run_key_unique",
    {
      unique: ["task_run_key"]
    }
  );

  // record schema version
  pgm.sql(`
    INSERT INTO schema_version (version, note)
    VALUES (3, 'add unique task_run_key for execution safety')
    ON CONFLICT (version) DO NOTHING;
  `);
}

export async function down(pgm) {
  pgm.dropConstraint("tasks", "tasks_task_run_key_unique", { ifExists: true });
  pgm.dropColumn("tasks", "task_run_key", { ifExists: true });
}
