// src/logging/BehaviorEventsService.js
// STAGE 5.16.2 — wiring target (service skeleton)
// Purpose: write observability behavior events into behavior_events table.

import pool from "../../db.js";

export class BehaviorEventsService {
  constructor({ dbPool } = {}) {
    this.pool = dbPool || pool;
  }

  /**
   * Minimal insert. No side-effects beyond DB write.
   * @param {object} p
   * @param {string|null} p.globalUserId
   * @param {string|null} p.chatId
   * @param {string} p.eventType
   * @param {object} [p.metadata]
   * @param {string} [p.transport]
   * @param {number} [p.schemaVersion]
   */
  async logEvent(p = {}) {
    const {
      globalUserId = null,
      chatId = null,
      eventType,
      metadata = {},
      transport = "telegram",
      schemaVersion = 1,
    } = p || {};

    if (!eventType) return { ok: false, reason: "missing_event_type" };

    try {
      await this.pool.query(
        `
        INSERT INTO behavior_events (
          global_user_id,
          chat_id,
          transport,
          event_type,
          metadata,
          schema_version
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6)
        `,
        [globalUserId, chatId, transport, eventType, JSON.stringify(metadata || {}), schemaVersion]
      );

      return { ok: true };
    } catch (e) {
      console.error("❌ BehaviorEventsService.logEvent failed:", e);
      return { ok: false, reason: "db_error" };
    }
  }
}

export default BehaviorEventsService;
