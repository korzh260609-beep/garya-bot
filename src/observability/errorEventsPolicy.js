// src/observability/errorEventsPolicy.js
// STAGE 5 — Observability V1
// Policy helpers for error_events:
// - D) Ignore synthetic TEST_FAIL events (do not write to error_events)
// - B) Retention planning helpers (actual purge wiring will be added later)
//
// IMPORTANT:
// - This module contains PURE functions only.
// - No DB access here (wiring will be done in a dedicated service/job later).
// - Add-only policy: do not delete/modify existing behavior here.

export const ERROR_EVENTS_DEFAULT_RETENTION_DAYS = 30;

// Synthetic test marker used by robotMock.js
export const ERROR_EVENTS_TEST_FAIL_MARKER =
  "TEST_FAIL: forced by payload.force_fail";

// ✅ Stage 5.16 — feature flag reader (default true)
export function getIgnoreTestFailEnabledFromEnv(env = process.env) {
  const raw = String(env?.ERROR_EVENTS_IGNORE_TEST_FAIL ?? "true")
    .trim()
    .toLowerCase();
  return raw === "true";
}

/**
 * Decide whether an error event should be ignored (not persisted).
 *
 * Usage:
 *   if (shouldIgnoreErrorEvent({ type, message })) return;
 *
 * Optional:
 *   shouldIgnoreErrorEvent({ type, message }, process.env)
 */
export function shouldIgnoreErrorEvent({ type, message }, env = process.env) {
  const t = String(type || "").toLowerCase();
  const msg = String(message?.message || message || "");

  // D) ignore forced test failures (noise), guarded by ENV flag
  if (
    getIgnoreTestFailEnabledFromEnv(env) &&
    t === "job_runner_failed" &&
    msg.includes(ERROR_EVENTS_TEST_FAIL_MARKER)
  ) {
    return true;
  }

  return false;
}

/**
 * Build a retention plan (no-op helper).
 * Real purge will be done by ErrorEventsRetentionService + scheduler wiring.
 */
export function getRetentionDaysFromEnv(env = process.env) {
  const raw = String(env.ERROR_EVENTS_RETENTION_DAYS || "").trim();
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 1 && n <= 3650) return Math.floor(n);
  return ERROR_EVENTS_DEFAULT_RETENTION_DAYS;
}
