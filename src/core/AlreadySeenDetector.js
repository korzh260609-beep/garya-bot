// src/core/AlreadySeenDetector.js
// STAGE 8B — ALREADY-SEEN DETECTOR
// 8B.1 ExtractQuery
// 8B.2 Tightened lookup
// 8B.3 Confidence threshold
// 8B.4 Real cooldown enforcement

import crypto from "crypto";
import { extractQuery } from "./alreadySeen/extractQuery.js";

function sha256Hex(text) {
  try {
    return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
  } catch (_) {
    return "";
  }
}

export default class AlreadySeenDetector {
  constructor(opts = {}) {
    this.db = opts.db || null;
    this.logger = opts.logger || console;
  }

  getEnabled() {
    return String(process.env.ALREADY_SEEN_ENABLED || "").trim().toLowerCase() === "true";
  }

  getCooldownSec() {
    const raw = String(process.env.ALREADY_SEEN_COOLDOWN_SEC || "").trim();
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
    return 0;
  }

  status() {
    return {
      enabled: this.getEnabled(),
      mode: "stage-8b",
      hasDb: Boolean(this.db),
      cooldown_sec: this.getCooldownSec(),
    };
  }

  async check({ chatId, globalUserId, text }) {
    const enabled = this.getEnabled();
    if (!enabled) return false;
    if (!this.db || !chatId || !text) return false;

    try {
      const q = extractQuery(text, { minKeywords: 3, maxKeywords: 7 });
      if (!q.ok) return false;

      const qHash = sha256Hex(q.normalized);
      if (!qHash) return false;

      // ===== 8B.2 + 8B.3 tightening =====
      const minScoreRaw = String(process.env.ALREADY_SEEN_MIN_SCORE || "").trim();
      const minScore = Number.isFinite(Number(minScoreRaw)) ? Number(minScoreRaw) : 3;

      function kwScore(w) {
        const s = String(w || "");
        if (s.length >= 6) return 2;
        return 1;
      }

      const kwSorted = [...q.keywords]
        .map((w) => String(w || "").trim())
        .filter(Boolean)
        .sort((a, b) => {
          const sa = kwScore(a);
          const sb = kwScore(b);
          if (sb !== sa) return sb - sa;
          return b.length - a.length;
        });

      const kw = kwSorted.slice(0, 3);

      const totalScore = kw.reduce((sum, w) => sum + kwScore(w), 0);
      if (totalScore < minScore) return false;

      // ===== 8B.4 Real Cooldown Check =====
      const cooldownSec = this.getCooldownSec();
      if (cooldownSec > 0) {
        const cd = await this.db.query(
          `
          SELECT 1
          FROM interaction_logs
          WHERE chat_id = $1
            AND task_type = 'already_seen_hit'
            AND created_at >= NOW() - ($2::int * INTERVAL '1 second')
          LIMIT 1
          `,
          [String(chatId), cooldownSec]
        );

        if (cd.rowCount > 0) {
          // cooldown skip metric
          try {
            await this.db.query(
              `
              INSERT INTO interaction_logs (chat_id, task_type, ai_cost_level)
              VALUES ($1, $2, $3)
              `,
              [String(chatId), "already_seen_cooldown_skip", "none"]
            );
          } catch (_) {}
          return false;
        }
      }

      const params = [String(chatId)];
      let where = "";
      for (let i = 0; i < kw.length; i++) {
        params.push(kw[i]);
        where += ` AND content ILIKE ('%' || $${params.length} || '%')`;
      }

      const r = await this.db.query(
        `
        SELECT COUNT(*)::int AS cnt
        FROM chat_messages
        WHERE chat_id = $1
          AND role = 'user'
          AND created_at >= NOW() - INTERVAL '10 minutes'
          ${where}
        `,
        params
      );

      const cnt = r?.rows?.[0]?.cnt || 0;

      if (cnt >= 2) {
        try {
          await this.db.query(
            `
            INSERT INTO interaction_logs (chat_id, task_type, ai_cost_level)
            VALUES ($1, $2, $3)
            `,
            [String(chatId), "already_seen_hit", "none"]
          );
        } catch (_) {}

        return true;
      }
    } catch (e) {
      this.logger?.error?.("AlreadySeenDetector error:", e);
    }

    return false;
  }
}
