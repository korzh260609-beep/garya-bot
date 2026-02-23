// src/core/RecallEngine.js
// STAGE 8A — RECALL ENGINE (MVP SKELETON, no embeddings)
// Goal: structure + interface + safe wiring points (does nothing when disabled)

export default class RecallEngine {
  constructor(opts = {}) {
    this.db = opts.db || null;
    this.logger = opts.logger || console;
    this.config = opts.config || {};
  }

  status() {
    const enabled = String(process.env.RECALL_ENABLED || "").trim().toLowerCase() === "true";
    return {
      enabled,
      mode: "skeleton",
      hasDb: Boolean(this.db),
    };
  }

  /**
   * Skeleton recall.
   * @returns {Promise<Array<{source:string, content:string, meta?:object}>>}
   */
  async recall({ chatId, globalUserId, query, limit = 5 } = {}) {
    const st = this.status();
    if (!st.enabled) return [];
    // STAGE 8A: no real logic yet
    return [];
  }

  /**
   * Build a single string block to inject into system messages.
   * In skeleton returns empty.
   */
  async buildRecallContext({ chatId, globalUserId, query, limit = 5 } = {}) {
    const items = await this.recall({ chatId, globalUserId, query, limit });
    if (!items || items.length === 0) return "";
    // Future: formatting rules here (not in 8A)
    return items.map((x) => `- [${x.source}] ${x.content}`).join("\n");
  }
}
