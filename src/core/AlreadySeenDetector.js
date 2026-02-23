// src/core/AlreadySeenDetector.js
// STAGE 8B — ALREADY-SEEN DETECTOR (SKELETON ONLY)
// STAGE 8B.1 — Observability: count already_seen_hits (NO BLOCKING)

import { redactText, sha256Text } from "./redaction.js";

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
   * STAGE 8B.1:
   * - detects "hit" (duplicate by text_hash in recent window)
   * - logs hit to interaction_logs
   * - DOES NOT block (caller may ignore return value)
   */
  async check({ chatId, globalUserId, text }) {
    const st = this.status();
    if (!st.enabled) return false;
    if (!this.db) return false;

    const chatIdStr = chatId === null || chatId === undefined ? "" : String(chatId);
    const inputText = typeof text === "string" ? text : "";
    if (!chatIdStr || !inputText.trim()) return false;

    // Must match how chat.js computes text_hash (redacted full text -> sha256)
    const redacted = redactText(inputText);
    const textHash = sha256Text(redacted);

    // window (seconds) — small by default; only observability now
    const windowSecRaw = Number(process.env.ALREADY_SEEN_WINDOW_SEC || 60);
    const windowSec = Number.isFinite(windowSecRaw) && windowSecRaw > 0 ? windowSecRaw : 60;

    let hit = false;

    try {
      // IMPORTANT:
      // chat.js does INSERT-FIRST for inbound user messages,
      // so current message is already in chat_messages.
      // Therefore "duplicate" = count >= 2 within window.
      const r = await this.db.query(
        `
          SELECT COUNT(*)::int AS cnt
          FROM chat_messages
          WHERE chat_id = $1
            AND role = 'user'
            AND text_hash = $2
            AND created_at >= NOW() - ($3::int * INTERVAL '1 second')
        `,
        [chatIdStr, textHash, windowSec]
      );

      const cnt = Number(r?.rows?.[0]?.cnt || 0);
      hit = cnt >= 2;
    } catch (e) {
      // fail-open: never break prod
      try {
        this.logger.error("❌ AlreadySeenDetector query failed (fail-open):", e);
      } catch (_) {}
      return false;
    }

    if (hit) {
      // STAGE 8B.1 — write counter event (no schema changes)
      try {
        await this.db.query(
          `
            INSERT INTO interaction_logs (chat_id, task_type, ai_cost_level)
            VALUES ($1, $2, $3)
          `,
          [chatIdStr, "already_seen_hit", "none"]
        );
      } catch (e) {
        // fail-open
        try {
          this.logger.error("❌ AlreadySeenDetector log hit failed (fail-open):", e);
        } catch (_) {}
      }
    }

    return hit;
  }
}
