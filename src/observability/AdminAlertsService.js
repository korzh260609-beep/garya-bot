// src/observability/AdminAlertsService.js
// STAGE 5.15 — ADMIN ALERTS (LOGIC, no auto-run)
// Purpose: evaluate metrics and send alert to monarch with cooldown control.

import pool from "../../db.js";
import {
  ADMIN_ALERTS_ENABLED,
  ADMIN_ALERT_DB_WARN_PCT,
  ADMIN_ALERT_DB_CRIT_PCT,
  ADMIN_ALERT_COOLDOWN_MIN,
} from "../core/config.js";

export class AdminAlertsService {
  constructor({ bot, monarchUserId }) {
    this.bot = bot;
    this.monarchUserId = monarchUserId;
  }

  async checkDbUsage({ usedMb, limitMb }) {
    if (!ADMIN_ALERTS_ENABLED) return;

    if (!usedMb || !limitMb || limitMb <= 0) return;

    const pct = Math.round((usedMb / limitMb) * 100);

    let level = null;
    if (pct >= ADMIN_ALERT_DB_CRIT_PCT) level = "critical";
    else if (pct >= ADMIN_ALERT_DB_WARN_PCT) level = "warning";

    if (!level) return;

    const alertKey = `db_usage_${level}`;

    const allowed = await this._cooldownPassed(alertKey);
    if (!allowed) return;

    await this._sendAlert(
      `⚠️ ADMIN ALERT\nDB usage: ${pct}% (${usedMb}MB / ${limitMb}MB)\nLevel: ${level.toUpperCase()}`
    );

    await this._markSent(alertKey, { pct, usedMb, limitMb });
  }

  async _cooldownPassed(alertKey) {
    const res = await pool.query(
      `SELECT last_sent_at FROM admin_alert_state WHERE alert_key = $1`,
      [alertKey]
    );

    const row = res.rows[0];
    if (!row || !row.last_sent_at) return true;

    const last = new Date(row.last_sent_at).getTime();
    const now = Date.now();
    const diffMin = (now - last) / 60000;

    return diffMin >= ADMIN_ALERT_COOLDOWN_MIN;
  }

  async _markSent(alertKey, value) {
    await pool.query(
      `
      INSERT INTO admin_alert_state (alert_key, last_sent_at, last_value, updated_at)
      VALUES ($1, NOW(), $2::jsonb, NOW())
      ON CONFLICT (alert_key)
      DO UPDATE SET
        last_sent_at = NOW(),
        last_value = $2::jsonb,
        updated_at = NOW()
      `,
      [alertKey, JSON.stringify(value || {})]
    );
  }

  async _sendAlert(text) {
    if (!this.bot || !this.monarchUserId) return;

    try {
      await this.bot.sendMessage(this.monarchUserId, text);
    } catch (e) {
      console.error("AdminAlertsService send failed:", e);
    }
  }
}

export default AdminAlertsService;
