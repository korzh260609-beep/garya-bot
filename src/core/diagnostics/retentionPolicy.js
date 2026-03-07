// src/core/diagnostics/retentionPolicy.js
// STAGE 7B.6 — retention policy skeleton (disabled)
// IMPORTANT:
// - skeleton only
// - no deletes
// - no archive moves
// - no scheduler
// - inspect / plan only

import { getRetentionConfig } from "./retentionConfig.js";

function normalizeRetentionDays(value) {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export function getRetentionPolicyState() {
  const config = getRetentionConfig();

  return {
    enabled: Boolean(config.ENABLED),
    archiveEnabled: Boolean(config.ARCHIVE_ENABLED),
    dryRunOnly: Boolean(config.DRY_RUN_ONLY),

    guestRetentionDays: normalizeRetentionDays(config.GUEST_RETENTION_DAYS),
    citizenRetentionDays: normalizeRetentionDays(config.CITIZEN_RETENTION_DAYS),
    monarchRetentionDays: normalizeRetentionDays(config.MONARCH_RETENTION_DAYS),

    monarchUnlimited: config.MONARCH_RETENTION_DAYS == null,
    runtimeAttached: false,
    cleanupStarted: false,
    archiveStarted: false,
  };
}

export function buildRetentionPlan() {
  const st = getRetentionPolicyState();

  return {
    enabled: st.enabled,
    archiveEnabled: st.archiveEnabled,
    dryRunOnly: st.dryRunOnly,
    runtimeAttached: st.runtimeAttached,
    cleanupStarted: st.cleanupStarted,
    archiveStarted: st.archiveStarted,
    scopes: {
      guest: {
        retentionDays: st.guestRetentionDays,
        action: "none",
      },
      citizen: {
        retentionDays: st.citizenRetentionDays,
        action: "none",
      },
      monarch: {
        retentionDays: st.monarchRetentionDays,
        unlimited: st.monarchUnlimited,
        action: "none",
      },
    },
  };
}

export default {
  getRetentionPolicyState,
  buildRetentionPlan,
};