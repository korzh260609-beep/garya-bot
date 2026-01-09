// ============================================================================
// === src/repo/RepoSource.js — GitHub Repo Source (SKELETON v2)
// ============================================================================

import { githubGetJson } from "./githubApi.js";

export class RepoSource {
  constructor({ repo, branch, token }) {
    this.repo = repo;     // "owner/name"
    this.branch = branch; // "main"
    this.token = token;   // fine-grained PAT
  }

  async listFiles() {
    // SKELETON: проверка доступа к репозиторию
    const url = `https://api.github.com/repos/${this.repo}`;
    await githubGetJson(url, { token: this.token });

    // пока не возвращаем файлы
    return [];
  }

  async fetchTextFile(path) {
    // SKELETON
    return null;
  }
}
