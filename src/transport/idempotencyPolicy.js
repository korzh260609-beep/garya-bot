// src/transport/idempotencyPolicy.js
// STAGE 6.8.2 — "no side-effects without idempotency" policy (SKELETON)
//
// Purpose:
//   Provide a single rule-gate for any future side-effects (DB writes, task runs, AI calls).
//   Until idempotency keys exist, side-effects must be blocked by policy.
//
// IMPORTANT:
//   Contract only. Not wired into production yet.
//   No DB. No side-effects.

function hasAnyIdempotencySignal(meta = {}) {
  if (!meta || typeof meta !== "object") return false;

  // Preferred canonical key (future)
  if (typeof meta.idempotencyKey === "string" && meta.idempotencyKey.trim()) return true;

  // Acceptable transport signals (future)
  if (typeof meta.messageId === "string" && meta.messageId.trim()) return true;
  if (typeof meta.updateId === "string" && meta.updateId.trim()) return true;

  // Numeric variants (Telegram often)
  if (Number.isFinite(Number(meta.messageId))) return true;
  if (Number.isFinite(Number(meta.updateId))) return true;

  return false;
}

/**
 * Policy: side-effects are allowed only if context has idempotency signal.
 * @param {object} context
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canPerformSideEffects(context = {}) {
  const meta = context?.meta || {};
  const ok = hasAnyIdempotencySignal(meta);

  if (!ok) {
    return {
      allowed: false,
      reason: "missing_idempotency_signal",
    };
  }

  return { allowed: true };
}

export default canPerformSideEffects;
