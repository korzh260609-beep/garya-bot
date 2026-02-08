// ============================================================================
// === src/repo/RepoSource.js — GitHub Repo Source (Variant A: fetch-on-demand)
// ============================================================================

import { githubGetJson } from "./githubApi.js";

const MAX_FILE_BYTES = 200 * 1024; // 200 KB

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

    // 4) Filters
    const denyPrefixes = ["node_modules/", ".git/", "dist/", "build/"];
    const denyExact = [
      ".env",
      ".env.local",
      ".env.production",
      ".env.development",
    ];
    const allowExt = [".js", ".ts", ".json", ".md", ".sql", ".yml", ".yaml"];
    const MAX_PATH_LEN = 300;

    return rawFiles.filter((p) => {
      if (!p || typeof p !== "string") return false;
      if (p.length > MAX_PATH_LEN) return false;
      if (denyExact.includes(p)) return false;
      if (denyPrefixes.some((pref) => p.startsWith(pref))) return false;
      return allowExt.some((ext) => p.toLowerCase().endsWith(ext));
    });
  }

  // ---------------------------------------------------------------------------
  // Fetch file content ON DEMAND (GitHub Contents API)
  // ---------------------------------------------------------------------------
  async fetchTextFile(path) {
    if (!path) return null;

    const url =
      `https://api.github.com/repos/${this.repo}/contents/${encodeURIComponent(
        path
      )}?ref=${encodeURIComponent(this.branch)}`;

    const json = await githubGetJson(url, { token: this.token });
    if (!json || json.type !== "file" || !json.content) return null;

    // Size guard (GitHub gives size in bytes)
    if (json.size && json.size > MAX_FILE_BYTES) return null;

    // Decode base64
    const buffer = Buffer.from(json.content, "base64");
    if (buffer.length > MAX_FILE_BYTES) return null;

    const text = buffer.toString("utf8");

    return {
      path,
      content: text,
    };
  }
}
