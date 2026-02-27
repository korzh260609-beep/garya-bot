// src/observability/ErrorEventsRetentionService.js
// Stage 5 — Observability V1
// Retention purge service for error_events (runtime scope only).

import pool from "../../db.js";
import { getRetentionDaysFromEnv } from "./errorEventsPolicy.js";

function envInt(name, def) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? Math.floor(n) : def;
}

export class ErrorEventsRetentionService {
  constructor(dbPool = pool) {
    this._pool = dbPool;

    // cooldown in minutes, default 60
    this._cooldownMin = Math.max(
      1,
      envInt("ERROR_EVENTS_PURGE_COOLDOWN_MIN", 60)
    );

    this._lastRunAtMs = 0;
  }

  _cooldownOk(nowMs) {
    const cdMs = this._cooldownMin * 60_000;
    return nowMs - this._lastRunAtMs >= cdMs;
  }

  async maybePurgeRuntimeScope() {
    const nowMs = Date.now();
    if (!this._cooldownOk(nowMs)) {
      return { ran: false, reason: "cooldown" };
    }

    this._lastRunAtMs = nowMs;

    const retentionDays = getRetentionDaysFromEnv(process.env);

    try {
      const r = await this._pool.query(
        `
        DELETE FROM error_events
        WHERE scope = 'runtime'
          AND created_at < NOW() - ($1::interval)
        `,
        [`${retentionDays} days`]
      );

      return {
        ran: true,
        deleted: r?.rowCount || 0,
        retentionDays,
        scope: "runtime",
      };
    } catch (e) {
      return {
        ran: true,
        deleted: 0,
        retentionDays,
        scope: "runtime",
        error: String(e?.message || e),
      };
    }
  }
}
