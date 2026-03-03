// src/transport/transportConfig.js
// Stage 6 — SKELETON CONFIG
// Controls future switch from messageRouter → Transport → Core
// IMPORTANT:
// - Default = disabled
// - No production behavior change

import { envStr } from "../core/config.js";

function parseBool(v, def = false) {
  if (v == null) return def;
  const s = String(v).trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(s);
}

export const TRANSPORT_ENFORCED = parseBool(
  envStr("TRANSPORT_ENFORCED", ""),
  false
);

export function isTransportEnforced() {
  return TRANSPORT_ENFORCED;
}

// ✅ NEW — independent trace flag (does NOT switch routing)
export const TRANSPORT_TRACE = parseBool(envStr("TRANSPORT_TRACE", ""), false);

export function isTransportTraceEnabled() {
  return TRANSPORT_TRACE;
}

export default {
  TRANSPORT_ENFORCED,
  isTransportEnforced,
  TRANSPORT_TRACE,
  isTransportTraceEnabled,
};
