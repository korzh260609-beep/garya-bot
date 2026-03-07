// src/core/diagnostics/healthConfig.js
// STAGE 7B — health thresholds + scheduler config
// Lightweight local config for diagnostics only.

export const HEALTH_THRESHOLDS = Object.freeze({
  DB_PING_WARN_MS: 300,
  EVENT_LOOP_LAG_WARN_MS: 50,
  HEAP_USED_WARN_MB: 300,
});

export const HEALTH_SCHEDULER_CONFIG = Object.freeze({
  ENABLED: false,
  INTERVAL_MS: 60_000,
  WARN_CONSECUTIVE_COUNT: 2,
  CRITICAL_CONSECUTIVE_COUNT: 3,
  LOG_TO_CONSOLE: true,
});

export function getHealthThresholds() {
  return HEALTH_THRESHOLDS;
}

export function getHealthSchedulerConfig() {
  return HEALTH_SCHEDULER_CONFIG;
}

export default HEALTH_THRESHOLDS;