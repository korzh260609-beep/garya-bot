// ============================================================================
// === src/repo/RepoIndexSnapshot.js — NORMALIZED INDEX SNAPSHOT
// ============================================================================

import { MemoryPolicy } from "../../core/MemoryPolicy.js";
import crypto from "crypto";

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
   * Stable hash helper (for deterministic candidate_id)
   */
  _hash(str) {
    return crypto.createHash("sha256").update(String(str || ""), "utf8").digest("hex");
  }

  /**
   * Build memory candidates in a strict, preview-only format (NO DB writes).
   * This is intended to be shown in /reindex response.
   */
  buildMemoryCandidatesPreview({ maxItems = 50 } = {}) {
    const allowed = this.getMemoryCandidates();

    const candidates = allowed.slice(0, Math.max(0, Number(maxItems) || 0)).map((f) => {
      // IMPORTANT: do NOT put full content into payload by default (avoid leaking secrets / bloat)
      const contentHash = this._hash(f.content || "");
      const candidateId = this._hash(`${this.repo}|${this.branch}|${f.path}|${contentHash}`);

      const isPillar = String(f.path || "").startsWith("pillars/");
      const type = isPillar ? "pillar_rule" : "repo_fact";

      return {
        candidate_id: candidateId,
        type,
        source: `repo:${f.path}`,
        title: isPillar ? `Pillar: ${f.path}` : `Repo: ${f.path}`,
        payload: {
          path: f.path,
          size: f.size,
          content_hash: contentHash,
          // preview snippet only (no full text)
          snippet: (f.content || "").slice(0, 400),
        },
        confidence: 0.8,
        sensitivity: isPillar ? "low" : "medium",
        proposed_action: "needs_review",
        why: "MemoryPolicy marked this file as allowed; preview is generated without writing to memory.",
      };
    });

    const byType = {};
    const bySensitivity = {};
    for (const c of candidates) {
      byType[c.type] = (byType[c.type] || 0) + 1;
      bySensitivity[c.sensitivity] = (bySensitivity[c.sensitivity] || 0) + 1;
    }

    return {
      candidatesTotal: allowed.length,
      previewCount: candidates.length,
      byType,
      bySensitivity,
      items: candidates,
    };
  }

  /**
   * Короткое резюме snapshot (для /reindex)
   */
  getSummary() {
    const preview = this.buildMemoryCandidatesPreview({ maxItems: 20 });

    return {
      repo: this.repo,
      branch: this.branch,
      createdAt: this.createdAt,
      stats: this.stats,
      snapshotFiles: this.files.length,
      memoryCandidates: this.getMemoryCandidates().length,
      memoryCandidatesPreview: {
        candidatesTotal: preview.candidatesTotal,
        previewCount: preview.previewCount,
        byType: preview.byType,
        bySensitivity: preview.bySensitivity,
        items: preview.items,
      },
    };
  }
}
