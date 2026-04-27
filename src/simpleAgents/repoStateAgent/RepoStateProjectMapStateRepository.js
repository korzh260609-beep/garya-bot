// src/simpleAgents/repoStateAgent/RepoStateProjectMapStateRepository.js

import crypto from "crypto";
import pool from "../../../db.js";

function toJson(value) {
  return JSON.stringify(value || {});
}

function hashSignature(signature) {
  return crypto.createHash("sha256").update(signature).digest("hex");
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
  const projectMapHash = hashSignature(projectMapSignature);

  const { rows } = await pool.query(
    `
      INSERT INTO repo_state_project_map_state
      (repo_full_name, branch, scan_run_id, project_map_signature, project_map_hash, project_map, ai_enabled, metadata)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb)
      RETURNING id
    `,
    [
      repoFullName,
      branch,
      scanRunId,
      projectMapSignature,
      projectMapHash,
      toJson(projectMap),
      Boolean(aiEnabled),
      toJson(metadata),
    ]
  );

  return rows[0];
}

export default {
  getLatestProjectMapState,
  saveProjectMapState,
};
