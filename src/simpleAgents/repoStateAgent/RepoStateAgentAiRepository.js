// src/simpleAgents/repoStateAgent/RepoStateAgentAiRepository.js
// ============================================================================
// Repo State Agent AI Repository
// PostgreSQL storage for AI analysis
// ============================================================================

import crypto from "node:crypto";
import pool from "../../../db.js";

function toJson(value) {
  return JSON.stringify(value || {});
}

function md5(value) {
  return crypto.createHash("md5").update(String(value || "")).digest("hex");
}

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
  const projectMapSignatureHash = md5(projectMapSignature);

  const { rows } = await pool.query(
    `
      INSERT INTO repo_state_ai_analysis
      (
        repo_full_name,
        branch,
        scan_run_id,
        project_map_signature,
        project_map_signature_hash,
        project_map,
        analysis
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
      RETURNING id
    `,
    [
      repoFullName,
      branch,
      scanRunId,
      projectMapSignature,
      projectMapSignatureHash,
      toJson(projectMap),
      toJson(analysis),
    ]
  );

  return rows[0];
}

export default {
  getLatestAiAnalysis,
  saveAiAnalysis,
};
