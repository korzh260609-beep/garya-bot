// src/core/retention/ChatHistoryRetentionService.js
// STAGE 7B.6 — Chat History retention (ENFORCEMENT, safe)
// - Disabled by default (env gate)
// - Batch delete, fail-open
// - Uses users.role via users.global_user_id join
// - Treats NULL global_user_id as guest

import pool from "../../../db.js";
import { RETENTION_POLICY } from "./retentionConfig.js";

function envTrue(name) {
  return String(process.env[name] || "").toLowerCase() === "true";
}
function envInt(name, def) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? Math.floor(n) : def;
}

export class ChatHistoryRetentionService {
  constructor(dbPool = pool) {
    this._pool = dbPool;

    // default: OFF (must be enabled explicitly)
    this._enabled = envTrue("CHAT_HISTORY_PURGE_ENABLED");

    // default cooldown: 60 min
    this._cooldownMin = Math.max(1, envInt("CHAT_HISTORY_PURGE_COOLDOWN_MIN", 60));

    // default batch limit: 2000 rows per run
    this._batchLimit = Math.max(50, envInt("CHAT_HISTORY_PURGE_BATCH_LIMIT", 2000));

    this._lastRunAtMs = 0;
  }

  _cooldownOk(nowMs) {
    const cdMs = this._cooldownMin * 60_000;
    return nowMs - this._lastRunAtMs >= cdMs;
  }

  _daysForRole(role) {
    if (role === "monarch") return RETENTION_POLICY.monarch_retention_days;
    if (role === "citizen") return RETENTION_POLICY.citizen_retention_days;
    return RETENTION_POLICY.guest_retention_days; // guest + unknown
  }

  async maybePurge() {
    if (!this._enabled) return { ran: false, reason: "disabled" };

    const nowMs = Date.now();
    if (!this._cooldownOk(nowMs)) return { ran: false, reason: "cooldown" };
    this._lastRunAtMs = nowMs;

    const roles = ["guest", "citizen"]; // monarch = unlimited by default
    const out = { ran: true, deleted: 0, perRole: {} };

    for (const role of roles) {
      const days = this._daysForRole(role);
      if (!Number.isFinite(days) || days === null) {
        out.perRole[role] = { skipped: true, reason: "unlimited_or_null" };
        continue;
      }

      try {
        const r = await this._pool.query(
          `
          WITH del AS (
            SELECT cm.id
            FROM chat_messages cm
            LEFT JOIN users u
              ON u.global_user_id = cm.global_user_id
            WHERE
              (
                ($1 = 'guest' AND (u.role IS NULL OR u.role = 'guest'))
                OR
                ($1 = 'citizen' AND u.role = 'citizen')
              )
              AND cm.created_at < NOW() - ($2::interval)
            ORDER BY cm.created_at ASC
            LIMIT $3
          )
          DELETE FROM chat_messages
          WHERE id IN (SELECT id FROM del)
          `,
          [role, `${days} days`, this._batchLimit]
        );

        const deleted = r?.rowCount || 0;
        out.deleted += deleted;
        out.perRole[role] = { days, deleted, batchLimit: this._batchLimit };
      } catch (e) {
        out.perRole[role] = { days, deleted: 0, error: String(e?.message || e) };
        // fail-open
      }
    }

    return out;
  }
}