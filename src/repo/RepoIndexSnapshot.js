// ============================================================================
// === src/repo/RepoIndexSnapshot.js — NORMALIZED INDEX SNAPSHOT
// ============================================================================

import { MemoryPolicy } from "../core/MemoryPolicy.js";

export class RepoIndexSnapshot {
  constructor({ repo, branch }) {
    this.repo = repo;
    this.branch = branch;
    this.createdAt = new Date().toISOString();

    this.stats = {
      filesListed: 0,
      filesFetched: 0,
      filesSkipped: 0,
    };

    /**
     * Нормализованное хранилище файлов
     * [{ path, size, content, memoryAllowed }]
     */
    this.files = [];
  }

  /**
   * Добавление файла в snapshot
   * Решение о памяти принимается ТОЛЬКО через MemoryPolicy
   */
  addFile({ path, content }) {
    const memoryAllowed = MemoryPolicy.isAllowed({
      path,
      content,
    });

    this.files.push({
      path,
      size: content ? content.length : 0,
      content: content || null,
      memoryAllowed,
    });
  }

  /**
   * Финализация статистики
   */
  finalize({ filesListed, filesFetched, filesSkipped }) {
    this.stats.filesListed = filesListed;
    this.stats.filesFetched = filesFetched;
    this.stats.filesSkipped = filesSkipped;
  }

  /**
   * То, что МОЖНО писать в память (решения, правила, столпы)
   */
  getMemoryCandidates() {
    return this.files.filter((f) => f.memoryAllowed);
  }

  /**
   * То, что НЕЛЬЗЯ писать в память (код, шум)
   */
  getNonMemoryFiles() {
    return this.files.filter((f) => !f.memoryAllowed);
  }

  /**
   * Короткое резюме snapshot (для /reindex)
   */
  getSummary() {
    return {
      repo: this.repo,
      branch: this.branch,
      createdAt: this.createdAt,
      stats: this.stats,
      snapshotFiles: this.files.length,
      memoryCandidates: this.getMemoryCandidates().length,
    };
  }
}
