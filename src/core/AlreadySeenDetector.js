// src/core/AlreadySeenDetector.js
// STAGE 8B — ALREADY-SEEN DETECTOR (SKELETON ONLY)
// Goal: structure only. No active blocking logic yet.

export default class AlreadySeenDetector {
  constructor(opts = {}) {
    this.db = opts.db || null;
    this.logger = opts.logger || console;
  }

  status() {
    const enabled =
      String(process.env.ALREADY_SEEN_ENABLED || "")
        .trim()
        .toLowerCase() === "true";

    return {
      enabled,
      mode: "skeleton",
      hasDb: Boolean(this.db),
    };
  }

  /**
   * Check if similar message was recently processed.
   * STAGE 8B: returns false always (no blocking).
   */
  async check({ chatId, globalUserId, text }) {
    const st = this.status();
    if (!st.enabled) return false;

    // No logic yet.
    return false;
  }
}
