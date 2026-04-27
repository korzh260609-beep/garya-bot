// migrations/046_fix_repo_state_project_map_hash.js

export const up = (pgm) => {
  pgm.addColumn("repo_state_project_map_state", {
    project_map_hash: { type: "text" },
  });

  pgm.sql(`
    UPDATE repo_state_project_map_state
    SET project_map_hash = md5(project_map_signature)
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

  pgm.dropColumn("repo_state_project_map_state", "project_map_hash", {
    ifExists: true,
  });
};
