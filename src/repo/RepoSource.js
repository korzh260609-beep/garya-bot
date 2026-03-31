// ============================================================================
// === src/repo/RepoSource.js — GitHub Repo Source (Variant A: fetch-on-demand)
// ============================================================================

import { githubGetJson } from "./githubApi.js";
import {
  MAX_TEXT_FILE_SIZE,
  isAllowedTextPath,
  isProbablyText,
} from "./textFilters.js";

export class RepoSource {
  constructor({ repo, branch, token }) {
    this.repo = repo;     // "owner/name"
    this.branch = branch; // "main"
    this.token = token;   // fine-grained PAT
  }

  // ---------------------------------------------------------------------------
  // List files (paths-only) — used by reindex
  // ---------------------------------------------------------------------------
  async listFiles() {
    // 1) Get ref -> commit SHA
    const refUrl = `https://api.github.com/repos/${this.repo}/git/ref/heads/${this.branch}`;
    const ref = await githubGetJson(refUrl, { token: this.token });

    const commitSha = ref?.object?.sha;
    if (!commitSha) return [];

    // 2) Get commit -> tree SHA
    const commitUrl = `https://api.github.com/repos/${this.repo}/git/commits/${commitSha}`;
    const commit = await githubGetJson(commitUrl, { token: this.token });

    const treeSha = commit?.tree?.sha;
    if (!treeSha) return [];

    // 3) Get tree (recursive)
    const treeUrl = `https://api.github.com/repos/${this.repo}/git/trees/${treeSha}?recursive=1`;
    const tree = await githubGetJson(treeUrl, { token: this.token });

    const rawFiles = Array.isArray(tree?.tree)
      ? tree.tree
          .filter((n) => n && n.type === "blob" && typeof n.path === "string")
          .map((n) => n.path)
      : [];

    return rawFiles.filter((p) => isAllowedTextPath(p));
  }

  // ---------------------------------------------------------------------------
  // Fetch file content ON DEMAND (GitHub Contents API)
  // ---------------------------------------------------------------------------
  async fetchTextFile(path) {
    if (!path || !isAllowedTextPath(path)) return null;

    const url =
      `https://api.github.com/repos/${this.repo}/contents/${encodeURIComponent(
        path
      )}?ref=${encodeURIComponent(this.branch)}`;

    const json = await githubGetJson(url, { token: this.token });
    if (!json || json.type !== "file" || !json.content) return null;

    // Size guard (GitHub gives size in bytes)
    if (json.size && json.size > MAX_TEXT_FILE_SIZE) return null;

    // Decode base64
    const buffer = Buffer.from(json.content, "base64");
    if (buffer.length > MAX_TEXT_FILE_SIZE) return null;
    if (!isProbablyText(buffer)) return null;

    const text = buffer.toString("utf8");

    return {
      path,
      content: text,
    };
  }
}