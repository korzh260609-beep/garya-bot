// src/simpleAgents/repoStateAgent/RepoStateProjectMapStateRepository.js
// ============================================================================
// Repo State Project Map State Repository
// Stores project map signatures independently from optional AI analysis.
// ============================================================================

import pool from "../../../db.js";

function toJson(value) {
  return JSON.stringify(value || {});
}

export async function getLatestProjectMapState(repoFullName, branch) {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM repo_state_project_map_state
      WHERE repo_full_name = $1 AND branch = $2
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [repoFullName, branch]
  );

  return rows[0] || null;
}

export async function saveProjectMapState({
  repoFullName,
  branch,
  scanRunId,
  projectMapSignature,
  projectMap,
  aiEnabled = false,
  metadata = {},
}) {
  const { rows } = await pool.query(
    `
      INSERT INTO repo_state_project_map_state
      (repo_full_name, branch, scan_run_id, project_map_signature, project_map, ai_enabled, metadata)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)
      RETURNING id
    `,
    [repoFullName, branch, scanRunId, projectMapSignature, toJson(projectMap), Boolean(aiEnabled), toJson(metadata)]
  );

  return rows[0];
}

export default {
  getLatestProjectMapState,
  saveProjectMapState,
};
