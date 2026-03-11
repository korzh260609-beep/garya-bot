// src/core/AlreadySeenDetector.js
// STAGE 8B — ALREADY-SEEN DETECTOR
// 8B.1 ExtractQuery
// 8B.2 Tightened lookup
// 8B.3 Confidence threshold
// 8B.4 Real cooldown enforcement
// 8B.6 Role-based depth (CONFIG/SKELETON, behavior unchanged by default)

import crypto from "crypto";
import { extractQuery } from "./alreadySeen/extractQuery.js";

function sha256Hex(text) {
  try {
    return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
  } catch (_) {
    return "";
  }
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const x = Math.trunc(n);
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (role === "monarch") return "monarch";
  if (role === "vip") return "vip";
  if (role === "citizen") return "citizen";
  return "guest";
}

function safeJsonParseObject(text) {
  try {
    const parsed = JSON.parse(String(text || ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
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

  // ==========================================================
  // STAGE 8B.6 — Role-based depth (CONFIG/SKELETON)
  // IMPORTANT:
  // - config-only step
  // - no role-based behavior change by default
  // - defaults must preserve current detector behavior
  // - no cross-group logic here
  // ==========================================================
  getDefaultDepthPolicy() {
    return {
      guest: {
        minKeywords: 3,
        maxKeywords: 7,
        lookupKeywords: 3,
      },
      citizen: {
        minKeywords: 3,
        maxKeywords: 7,
        lookupKeywords: 3,
      },
      vip: {
        minKeywords: 3,
        maxKeywords: 7,
        lookupKeywords: 3,
      },
      monarch: {
        minKeywords: 3,
        maxKeywords: 7,
        lookupKeywords: 3,
      },
    };
  }

  getRoleDepthPolicy() {
    const defaults = this.getDefaultDepthPolicy();

    const rawJson = String(process.env.ALREADY_SEEN_ROLE_DEPTH_JSON || "").trim();
    if (!rawJson) return defaults;

    const parsed = safeJsonParseObject(rawJson);
    if (!parsed) return defaults;

    const out = { ...defaults };

    for (const roleKey of Object.keys(defaults)) {
      const src = parsed?.[roleKey];
      if (!src || typeof src !== "object" || Array.isArray(src)) continue;

      out[roleKey] = {
        minKeywords: clampInt(
          src.minKeywords,
          1,
          10,
          defaults[roleKey].minKeywords
        ),
        maxKeywords: clampInt(
          src.maxKeywords,
          1,
          20,
          defaults[roleKey].maxKeywords
        ),
        lookupKeywords: clampInt(
          src.lookupKeywords,
          1,
          10,
          defaults[roleKey].lookupKeywords
        ),
      };

      if (out[roleKey].maxKeywords < out[roleKey].minKeywords) {
        out[roleKey].maxKeywords = out[roleKey].minKeywords;
      }

      if (out[roleKey].lookupKeywords > out[roleKey].maxKeywords) {
        out[roleKey].lookupKeywords = out[roleKey].maxKeywords;
      }
    }

    return out;
  }

  resolveDepthForRole(role) {
    const normalizedRole = normalizeRole(role);
    const policy = this.getRoleDepthPolicy();
    return policy[normalizedRole] || policy.guest || this.getDefaultDepthPolicy().guest;
  }

  status() {
    return {
      enabled: this.getEnabled(),
      mode: "stage-8b",
      hasDb: Boolean(this.db),
      cooldown_sec: this.getCooldownSec(),
      role_depth_policy: this.getRoleDepthPolicy(),
    };
  }

  async check({ chatId, globalUserId, text, role = "guest" }) {
    const enabled = this.getEnabled();
    if (!enabled) return false;
    if (!this.db || !chatId || !text) return false;

    try {
      const depth = this.resolveDepthForRole(role);

      const q = extractQuery(text, {
        minKeywords: depth.minKeywords,
        maxKeywords: depth.maxKeywords,
      });
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

      const lookupKeywords = clampInt(
        depth.lookupKeywords,
        1,
        10,
        3
      );

      const kw = kwSorted.slice(0, lookupKeywords);

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
        SELECT
          COUNT(*)::int AS cnt,
          MAX(created_at) AS last_at
        FROM chat_messages
        WHERE chat_id = $1
          AND role = 'user'
          AND created_at >= NOW() - INTERVAL '10 minutes'
          ${where}
        `,
        params
      );

      const cnt = r?.rows?.[0]?.cnt || 0;
      const lastAt = r?.rows?.[0]?.last_at || null;

      // stash for UX (8B.5)
      this._lastMatchAt = lastAt;

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

  getLastMatchAt() {
    return this._lastMatchAt || null;
  }
}