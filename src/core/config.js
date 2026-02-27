// ===============================
// STAGE 5.15 — ADMIN ALERTS CONFIG
// ===============================

export const ADMIN_ALERTS_ENABLED =
  String(process.env.ADMIN_ALERTS_ENABLED || "true").toLowerCase() === "true";

export const ADMIN_ALERT_DB_WARN_PCT = envIntRange(
  "ADMIN_ALERT_DB_WARN_PCT",
  70,
  { min: 50, max: 95 }
);

export const ADMIN_ALERT_DB_CRIT_PCT = envIntRange(
  "ADMIN_ALERT_DB_CRIT_PCT",
  85,
  { min: 60, max: 99 }
);

export const ADMIN_ALERT_COOLDOWN_MIN = envIntRange(
  "ADMIN_ALERT_COOLDOWN_MIN",
  30,
  { min: 1, max: 1440 }
);
