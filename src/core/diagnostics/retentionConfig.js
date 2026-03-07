// src/core/diagnostics/retentionConfig.js
// STAGE 7B.6 — retention policy skeleton (disabled)
// IMPORTANT:
// - config only
// - no runtime attach
// - no cleanup loop
// - no deletes
// - monarch retention is unlimited

export const RETENTION_CONFIG = Object.freeze({
  ENABLED: false,
  ARCHIVE_ENABLED: false,

  GUEST_RETENTION_DAYS: 30,
  CITIZEN_RETENTION_DAYS: 180,
  MONARCH_RETENTION_DAYS: null, // unlimited

  DRY_RUN_ONLY: true,
});

export function getRetentionConfig() {
  return RETENTION_CONFIG;
}

export default RETENTION_CONFIG;