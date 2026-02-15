// src/jobs/retryPolicy.js
// 2.7.3 retry policy skeleton (max_retries/backoff/jitter)
// NOTE: pure helper. No DB, no queue integration yet.

export function getRetryPolicy() {
  return {
    maxRetries: Number(process.env.JOB_MAX_RETRIES || 3),
    baseDelayMs: Number(process.env.JOB_RETRY_BASE_DELAY_MS || 2000),
    maxDelayMs: Number(process.env.JOB_RETRY_MAX_DELAY_MS || 30000),
    jitterRatio: Number(process.env.JOB_RETRY_JITTER_RATIO || 0.2), // 20%
  };
}

export function computeBackoffDelayMs(attempt, policy = getRetryPolicy()) {
  // attempt: 1..N
  const exp = Math.max(0, attempt - 1);
  const raw = policy.baseDelayMs * Math.pow(2, exp);
  const capped = Math.min(raw, policy.maxDelayMs);

  // jitter: +/- jitterRatio
  const jitter = capped * policy.jitterRatio;
  const rand = (Math.random() * 2 - 1) * jitter;

  return Math.max(0, Math.floor(capped + rand));
}

export function shouldRetry(attempt, policy = getRetryPolicy()) {
  return attempt < policy.maxRetries;
}
