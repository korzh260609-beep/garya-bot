// src/core/AlreadySeenDetector.js
// STAGE 8B — ALREADY-SEEN DETECTOR
// 8B.1 — ExtractQuery (3–7 keywords, normalized) + hit detection based on keywords
// 8B.2 — cooldown metric placeholder
// 8B.3 — cooldown ENV support
//
// NOTE: This is still lightweight + fail-open, no blocking logic yet.
// It only returns true/false to allow soft UI hint in chat.js.

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
    return 0; // default: no cooldown
  }

  status() {
    return {
      enabled: this.getEnabled(),
      mode: "stage-8b",
      hasDb: Boolean(this.db),
      cooldown_sec: this.getCooldownSec(),
    };
  }

  /**
   * Check if similar message was recently processed.
   * Stage 8B: return true only for a "soft hint" (UI-level).
   * Fail-open: any error => false.
   */
  async check({ chatId, globalUserId, text }) {
    const enabled = this.getEnabled();
    if (!enabled) return false;
    if (!this.db || !chatId || !text) return false;

    try {
      // 8B.1 ExtractQuery
      const q = extractQuery(text, { minKeywords: 3, maxKeywords: 7 });
      if (!q.ok) return false;

      // Use normalized query hash for stable fingerprint (internal only)
      const qHash = sha256Hex(q.normalized);
      if (!qHash) return false;

      // 8B.2 FastLookup (MVP): AND-match 3 strongest keywords in recent window
      // IMPORTANT: current message is already inserted into chat_messages (insert-first),
      // so we use cnt>=2 as signal "seen before".

      // 8B.2 tightening + confidence threshold (reduce false-positives)
      const minScoreRaw = String(process.env.ALREADY_SEEN_MIN_SCORE || "").trim();
      const minScore = Number.isFinite(Number(minScoreRaw)) ? Number(minScoreRaw) : 4; // default 4

      function kwScore(w) {
        const s = String(w || "");
        if (s.length >= 6) return 2; // “stronger” token
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
        // Metric: already_seen_hit (compat with current interaction_logs schema)
        try {
          await this.db.query(
            `
            INSERT INTO interaction_logs (chat_id, task_type, ai_cost_level)
            VALUES ($1, $2, $3)
            `,
            [String(chatId), "already_seen_hit", "none"]
          );
        } catch (_) {}

        // Metric: already_seen_cooldown_skip (compat with current interaction_logs schema)
        const cooldownSec = this.getCooldownSec();
        if (cooldownSec > 0) {
          try {
            await this.db.query(
              `
              INSERT INTO interaction_logs (chat_id, task_type, ai_cost_level)
              VALUES ($1, $2, $3)
              `,
              [String(chatId), "already_seen_cooldown_skip", "none"]
            );
          } catch (_) {}
        }

        // ✅ For Stage 8B: allow soft hint in chat.js
        return true;
      }
    } catch (e) {
      this.logger?.error?.("AlreadySeenDetector error:", e);
    }

    return false;
  }
}
