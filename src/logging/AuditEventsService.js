// src/logging/AuditEventsService.js
// Stage 11.16 — audit_events minimal service
// Purpose:
// - write audit events into audit_events table
// - keep audit semantics separate from behavior_events / observability

import pool from "../../db.js";

export class AuditEventsService {
  constructor({ dbPool } = {}) {
    this.pool = dbPool || pool;
  }

  /**
   * Minimal insert. No side-effects beyond DB write.
   * @param {object} p
   * @param {string|null} p.globalUserId
   * @param {string|null} p.chatId
   * @param {string} p.eventType
   * @param {string|null} [p.actorRef]
   * @param {object} [p.metadata]
   * @param {string} [p.transport]
   * @param {number} [p.schemaVersion]
   */
  async logEvent(p = {}) {
    const {
      globalUserId = null,
      chatId = null,
      eventType,
      actorRef = null,
      metadata = {},
      transport = "telegram",
      schemaVersion = 1,
    } = p || {};

    if (!eventType) {
      return { ok: false, reason: "missing_event_type" };
    }

    try {
      await this.pool.query(
        `
        INSERT INTO audit_events (
          global_user_id,
          chat_id,
          transport,
          event_type,
          actor_ref,
          metadata,
          schema_version
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        `,
        [
          globalUserId,
          chatId,
          transport,
          eventType,
          actorRef,
          JSON.stringify(metadata || {}),
          schemaVersion,
        ]
      );

      return { ok: true };
    } catch (e) {
      console.error("❌ AuditEventsService.logEvent failed:", e);
      return { ok: false, reason: "db_error" };
    }
  }
}

export default AuditEventsService;