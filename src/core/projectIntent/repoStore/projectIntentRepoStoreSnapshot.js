// src/core/projectIntent/repoStore/projectIntentRepoStoreSnapshot.js

import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";
import {
  safeText,
  normalizePath,
} from "../projectIntentConversationShared.js";
import {
  isFileLike,
  normalizeFolderPath,
} from "./projectIntentRepoStorePathUtils.js";

export async function loadLatestSnapshot() {
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;

  const store = new RepoIndexStore({ pool });
  const latest = await store.getLatestSnapshot({ repo, branch });

  if (!latest) {
    return {
      ok: false,
      repo,
      branch,
      latest: null,
      filesCount: 0,
    };
  }

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM repo_index_files WHERE snapshot_id = $1`,
    [latest.id]
  );

  return {
    ok: true,
    repo,
    branch,
    latest,
    filesCount: countRes?.rows?.[0]?.cnt ?? 0,
  };
}

export async function pathExistsInSnapshot(snapshotId, path) {
  const normalized = normalizePath(path);
  if (!normalized) return false;

  const fileRes = await pool.query(
    `SELECT 1 FROM repo_index_files WHERE snapshot_id = $1 AND path = $2 LIMIT 1`,
    [snapshotId, normalized]
  );

  if (Array.isArray(fileRes?.rows) && fileRes.rows.length > 0) {
    return true;
  }

  if (!isFileLike(normalized)) {
    const folderPrefix = normalizeFolderPath(normalized);
    if (!folderPrefix) return false;

    const folderRes = await pool.query(
      `SELECT 1 FROM repo_index_files WHERE snapshot_id = $1 AND path ILIKE $2 LIMIT 1`,
      [snapshotId, `${folderPrefix}%`]
    );

    return Array.isArray(folderRes?.rows) && folderRes.rows.length > 0;
  }

  return false;
}

export async function pathKindInSnapshot(snapshotId, path) {
  const normalized = normalizePath(path);
  if (!normalized) return "unknown";

  const fileRes = await pool.query(
    `SELECT 1 FROM repo_index_files WHERE snapshot_id = $1 AND path = $2 LIMIT 1`,
    [snapshotId, normalized]
  );

  if (Array.isArray(fileRes?.rows) && fileRes.rows.length > 0) {
    return "file";
  }

  if (!isFileLike(normalized)) {
    const folderPrefix = normalizeFolderPath(normalized);
    const folderRes = await pool.query(
      `SELECT 1 FROM repo_index_files WHERE snapshot_id = $1 AND path ILIKE $2 LIMIT 1`,
      [snapshotId, `${folderPrefix}%`]
    );

    if (Array.isArray(folderRes?.rows) && folderRes.rows.length > 0) {
      return "folder";
    }
  }

  return "unknown";
}

export async function fetchPathsByPrefix(snapshotId, prefix = "") {
  const p = normalizePath(prefix);

  if (!p) {
    const res = await pool.query(
      `SELECT path FROM repo_index_files WHERE snapshot_id = $1 ORDER BY path ASC`,
      [snapshotId]
    );
    return Array.isArray(res?.rows)
      ? res.rows.map((r) => safeText(r.path)).filter(Boolean)
      : [];
  }

  const normalizedFolder = normalizeFolderPath(p);
  const exactLike = p;
  const prefixLike = normalizedFolder ? `${normalizedFolder}%` : `${p}%`;

  const res = await pool.query(
    `SELECT path
       FROM repo_index_files
      WHERE snapshot_id = $1
        AND (
          path ILIKE $2
          OR path ILIKE $3
          OR path = $4
        )
      ORDER BY path ASC`,
    [snapshotId, prefixLike, `${p}%`, exactLike]
  );

  return Array.isArray(res?.rows)
    ? res.rows.map((r) => safeText(r.path)).filter(Boolean)
    : [];
}

export async function fetchAllSnapshotPaths(snapshotId) {
  const res = await pool.query(
    `SELECT path FROM repo_index_files WHERE snapshot_id = $1 ORDER BY path ASC`,
    [snapshotId]
  );
  return Array.isArray(res?.rows)
    ? res.rows.map((r) => safeText(r.path)).filter(Boolean)
    : [];
}

export function computeImmediateChildren(paths = [], prefix = "") {
  const normalizedPrefix = safeText(prefix)
    ? (safeText(prefix).endsWith("/") ? safeText(prefix) : `${safeText(prefix)}/`)
    : "";

  const dirs = new Set();
  const files = new Set();

  for (const fullPathRaw of paths) {
    const fullPath = safeText(fullPathRaw);
    if (!fullPath) continue;

    const rest = normalizedPrefix
      ? fullPath.startsWith(normalizedPrefix)
        ? fullPath.slice(normalizedPrefix.length)
        : ""
      : fullPath;

    if (!rest) continue;

    const parts = rest.split("/").filter(Boolean);
    if (!parts.length) continue;

    if (parts.length === 1) {
      files.add(parts[0]);
    } else {
      dirs.add(parts[0]);
    }
  }

  return {
    directories: [...dirs].sort(),
    files: [...files].sort(),
  };
}

export default {
  loadLatestSnapshot,
  pathExistsInSnapshot,
  pathKindInSnapshot,
  fetchPathsByPrefix,
  fetchAllSnapshotPaths,
  computeImmediateChildren,
};