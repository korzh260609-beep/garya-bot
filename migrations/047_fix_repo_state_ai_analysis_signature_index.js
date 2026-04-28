// migrations/047_fix_repo_state_ai_analysis_signature_index.js

export const up = (pgm) => {
  pgm.dropIndex("repo_state_ai_analysis", ["project_map_signature"], {
    ifExists: true,
  });

  pgm.addColumn("repo_state_ai_analysis", {
    project_map_signature_hash: { type: "text" },
  });

  pgm.sql(`
    UPDATE repo_state_ai_analysis
    SET project_map_signature_hash = md5(project_map_signature)
    WHERE project_map_signature_hash IS NULL
  `);

  pgm.alterColumn("repo_state_ai_analysis", "project_map_signature_hash", {
    notNull: true,
  });

  pgm.createIndex("repo_state_ai_analysis", ["project_map_signature_hash"], {
    name: "repo_state_ai_analysis_project_map_signature_hash_index",
  });
};

export const down = (pgm) => {
  pgm.dropIndex("repo_state_ai_analysis", ["project_map_signature_hash"], {
    name: "repo_state_ai_analysis_project_map_signature_hash_index",
    ifExists: true,
  });

  pgm.dropColumn("repo_state_ai_analysis", "project_map_signature_hash", {
    ifExists: true,
  });

  pgm.createIndex("repo_state_ai_analysis", ["project_map_signature"], {
    name: "repo_state_ai_analysis_project_map_signature_index",
  });
};
