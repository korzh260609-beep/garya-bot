// src/db/errorEventsRepo.js
// Stage 5 — Observability V1
// Minimal writer for error_events (safe, no-throw policy recommended at call sites)

export class ErrorEventsRepo {
  constructor(pool) {
    this.pool = pool;
  }

  async write({
    scope,
    scopeId = null,
    eventType,
    severity = "error",
    message,
    context = {},
  }) {
    // NEVER log secrets here. Keep context small and safe.
    const safeMessage = message ? String(message).slice(0, 4000) : "unknown";
    const safeContext =
      context && typeof context === "object" ? context : { raw: String(context) };

    await this.pool.query(
      `
      INSERT INTO error_events (scope, scope_id, event_type, severity, message, context)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        String(scope),
        scopeId === null ? null : Number(scopeId),
        String(eventType),
        String(severity),
        safeMessage,
        JSON.stringify(safeContext),
      ]
    );
  }
}
