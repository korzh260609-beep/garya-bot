// src/bot/rateLimiter.js
// Stage 3.5 — RateLimit V1 (in-memory, per instance)
// NOTE: multi-instance/global RL будет на Stage 6.8 / Stage 9 (DB/Redis).

const __rlState = new Map(); // key -> [timestamps]

export function checkRateLimit({ key, windowMs, max }) {
  const now = Date.now();

  const arr = __rlState.get(key) || [];
  const fresh = arr.filter((t) => now - t < windowMs);

  if (fresh.length >= max) {
    const oldest = fresh[0];
    const retryAfterMs = Math.max(0, windowMs - (now - oldest));
    __rlState.set(key, fresh);
    return { allowed: false, retryAfterMs };
  }

  fresh.push(now);
  __rlState.set(key, fresh);
  return { allowed: true, retryAfterMs: 0 };
}
