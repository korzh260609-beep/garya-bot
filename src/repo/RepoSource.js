// ============================================================================
// === src/repo/RepoSource.js — GitHub Repo Source (SKELETON v5: list tree + filters + fetchTextFile)
// ============================================================================

import { githubGetJson } from "./githubApi.js";

export class RepoSource {
  constructor({ repo, branch, token }) {
    this.repo = repo; // "owner/name"
    this.branch = branch; // "main"
    this.token = token; // fine-grained PAT
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
    const rawFiles = Array.isArray(tree?.tree)
      ? tree.tree
          .filter((n) => n && n.type === "blob" && typeof n.path === "string")
          .map((n) => n.path)
      : [];

    // 5) Filters (denylist + allowlist + path length)
    const denyPrefixes = ["node_modules/", ".git/", "dist/", "build/"];
    const denyExact = [
      ".env",
      ".env.local",
      ".env.production",
      ".env.development",
    ];
    const allowExt = [".js", ".ts", ".json", ".md", ".sql", ".yml", ".yaml"];
    const MAX_PATH_LEN = 300;

    const files = rawFiles.filter((p) => {
      if (!p || typeof p !== "string") return false;
      if (p.length > MAX_PATH_LEN) return false;

      // exact deny
      if (denyExact.includes(p)) return false;

      // prefix deny
      for (const pref of denyPrefixes) {
        if (p.startsWith(pref)) return false;
      }

      // extension allowlist
      const lower = p.toLowerCase();
      const okExt = allowExt.some((ext) => lower.endsWith(ext));
      if (!okExt) return false;

      return true;
    });

    return files;
  }

  async fetchTextFile(path) {
    // 1) Загружаем raw-контент файла
    const rawUrl = `https://raw.githubusercontent.com/${this.repo}/${this.branch}/${path}`;

    const headers = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(rawUrl, { headers });
    if (!res.ok) return null;

    // 2) Проверяем размер по Content-Length (если есть)
    const len = res.headers.get("content-length");
    if (len && Number(len) > 200 * 1024) return null;

    // 3) Читаем текст
    const text = await res.text();

    // 4) Доп. защита: реальный размер
    if (text.length > 200 * 1024) return null;

    return {
      path,
      content: text,
    };
  }
}
