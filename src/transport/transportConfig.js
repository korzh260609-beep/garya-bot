// src/transport/transportConfig.js
// Stage 6 — SKELETON CONFIG
// Controls future switch from messageRouter → Transport → Core
// IMPORTANT:
// - Default = disabled
// - No production behavior change

function parseBool(v, def = false) {
  if (v == null) return def;
  const s = String(v).trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(s);
}

export const TRANSPORT_ENFORCED = parseBool(
  process.env.TRANSPORT_ENFORCED,
  false
);

export function isTransportEnforced() {
  return TRANSPORT_ENFORCED;
}

export default {
  TRANSPORT_ENFORCED,
  isTransportEnforced,
};
