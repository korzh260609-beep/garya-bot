// src/core/diagnostics/healthConfig.js
// STAGE 7B — health thresholds config
// Lightweight local config for diagnostics only.

export const HEALTH_THRESHOLDS = Object.freeze({
  DB_PING_WARN_MS: 300,
  EVENT_LOOP_LAG_WARN_MS: 50,
  HEAP_USED_WARN_MB: 300,
});

export function getHealthThresholds() {
  return HEALTH_THRESHOLDS;
}

export default HEALTH_THRESHOLDS;