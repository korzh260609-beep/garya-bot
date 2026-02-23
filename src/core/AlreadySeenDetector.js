// src/core/AlreadySeenDetector.js
// STAGE 8B — ALREADY-SEEN DETECTOR
// 8B.1 — hit detection
// 8B.2 — cooldown metric
// 8B.3 — cooldown ENV support (no blocking yet)

export default class AlreadySeenDetector {
  constructor(opts = {}) {
    this.db = opts.db || null;
    this.logger = opts.logger || console;
  }

  getEnabled() {
    return (
      String(process.env.ALREADY_SEEN_ENABLED || "")
        .trim()
        .toLowerCase() === "true"
    );
  }

  getCooldownSec() {
    const raw = String(process.env.ALREADY_SEEN_COOLDOWN_SEC || "").trim();
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
    return 0; // default: no cooldown
  }

  status() {
    return {
      enabled: this.getEnabled(),
      mode: "skeleton",
      hasDb: Boolean(this.db),
      cooldown_sec: this.getCooldownSec(),
    };
  }

  /**
   * Check if similar message was recently processed.
   * STAGE 8B:
   * - hit detection works
   * - cooldown ENV is readable
   * - no real blocking yet
   */
  async check({ chatId, globalUserId, text }) {
    const enabled = this.getEnabled();
    if (!enabled) return false;

    if (!this.db || !chatId || !text) return false;

    try {
      const cooldownSec = this.getCooldownSec();

      const r = await this.db.query(
        `
        SELECT COUNT(*)::int AS cnt
        FROM chat_messages
        WHERE chat_id = $1
          AND role = 'user'
          AND text_hash = encode(digest($2, 'sha256'), 'hex')
          AND created_at >= NOW() - INTERVAL '5 minutes'
        `,
        [chatId, text]
      );

      const cnt = r?.rows?.[0]?.cnt || 0;

      if (cnt >= 2) {
        // STAGE 8B.1 metric (hit)
        try {
          await this.db.query(
            `
            INSERT INTO interaction_logs (task_type, payload)
            VALUES ('already_seen_hit', $1)
            `,
            [JSON.stringify({ chatId, globalUserId })]
          );
        } catch (_) {}

        // STAGE 8B.2 metric (cooldown skip placeholder)
        if (cooldownSec > 0) {
          try {
            await this.db.query(
              `
              INSERT INTO interaction_logs (task_type, payload)
              VALUES ('already_seen_cooldown_skip', $1)
              `,
              [JSON.stringify({ chatId, cooldownSec })]
            );
          } catch (_) {}
        }

        // STAGE 8B — no blocking yet
        return false;
      }
    } catch (e) {
      this.logger.error("AlreadySeenDetector error:", e);
    }

    return false;
  }
}
