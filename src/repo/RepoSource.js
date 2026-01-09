// ============================================================================
// === src/repo/RepoSource.js — GitHub Repo Source (SKELETON v3: list tree)
// ============================================================================

import { githubGetJson } from "./githubApi.js";

export class RepoSource {
  constructor({ repo, branch, token }) {
    this.repo = repo;     // "owner/name"
    this.branch = branch; // "main"
    this.token = token;   // fine-grained PAT
  }

  async listFiles() {
    // 1) Получаем SHA коммита для ветки через ref
    const refUrl = `https://api.github.com/repos/${this.repo}/git/ref/heads/${this.branch}`;
    const ref = await githubGetJson(refUrl, { token: this.token });

    const commitSha = ref?.object?.sha;
    if (!commitSha) return [];

    // 2) Получаем commit object, чтобы достать tree SHA
    const commitUrl = `https://api.github.com/repos/${this.repo}/git/commits/${commitSha}`;
    const commit = await githubGetJson(commitUrl, { token: this.token });

    const treeSha = commit?.tree?.sha;
    if (!treeSha) return [];

    // 3) Получаем дерево файлов (recursive)
    const treeUrl = `https://api.github.com/repos/${this.repo}/git/trees/${treeSha}?recursive=1`;
    const tree = await githubGetJson(treeUrl, { token: this.token });

    // 4) Возвращаем только файлы (blob)
    const files = Array.isArray(tree?.tree)
      ? tree.tree
          .filter((n) => n && n.type === "blob" && typeof n.path === "string")
          .map((n) => n.path)
      : [];

    return files;
  }

  async fetchTextFile(path) {
    // SKELETON
    return null;
  }
}
