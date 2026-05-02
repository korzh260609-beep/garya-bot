// migrations/046_fix_repo_state_project_map_hash.js

export const up = (pgm) => {
  // 045 already creates repo_state_project_map_state.project_map_hash.
  // Keep this migration idempotent for environments where 045 is already applied.
  // Runtime writes SHA-256 hashes, so this migration must not backfill md5 values.
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'repo_state_project_map_state'
          AND column_name = 'project_map_hash'
      ) THEN
        ALTER TABLE repo_state_project_map_state
        ADD COLUMN project_map_hash text;
      END IF;
    END $$;
  `);

  pgm.sql(`
    UPDATE repo_state_project_map_state
    SET project_map_hash = encode(digest(project_map_signature, 'sha256'), 'hex')
    WHERE project_map_hash IS NULL
  `);

  pgm.alterColumn("repo_state_project_map_state", "project_map_hash", {
    notNull: true,
  });

  pgm.sql(`
    DROP INDEX IF EXISTS repo_state_project_map_state_project_map_signature_index
  `);

  pgm.createIndex("repo_state_project_map_state", ["project_map_hash"], {
    name: "repo_state_project_map_state_project_map_hash_index",
    ifNotExists: true,
  });
};

export const down = (pgm) => {
  pgm.dropIndex("repo_state_project_map_state", ["project_map_hash"], {
    name: "repo_state_project_map_state_project_map_hash_index",
    ifExists: true,
  });

  // Do not drop project_map_hash here: migration 045 owns this column.
};
