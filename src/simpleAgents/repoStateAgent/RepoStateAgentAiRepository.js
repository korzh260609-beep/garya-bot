// src/simpleAgents/repoStateAgent/RepoStateAgentAiRepository.js
// ============================================================================
// Repo State Agent AI Repository
// PostgreSQL storage for AI analysis
// ============================================================================

import { pool } from "../../db/db.js";

export async function getLatestAiAnalysis(repoFullName, branch) {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM repo_state_ai_analysis
      WHERE repo_full_name = $1 AND branch = $2
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [repoFullName, branch]
  );

  return rows[0] || null;
}

export async function saveAiAnalysis({
  repoFullName,
  branch,
  scanRunId,
  projectMapSignature,
  projectMap,
  analysis,
}) {
  const { rows } = await pool.query(
    `
      INSERT INTO repo_state_ai_analysis
      (repo_full_name, branch, scan_run_id, project_map_signature, project_map, analysis)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [repoFullName, branch, scanRunId, projectMapSignature, projectMap, analysis]
  );

  return rows[0];
}

export default {
  getLatestAiAnalysis,
  saveAiAnalysis,
};
