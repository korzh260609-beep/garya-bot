// AGENT NOTE:
// SG 2.0 basic Monarch gate.
// Purpose: protect early Telegram runtime from unauthorized users while permissions module is still skeleton-level.
// Do not expand this into full roles/plans logic without approved permissions skeleton and final МОЖНО.

import { envStr } from "../config/env.js";

export function getMonarchUserId() {
  return envStr("MONARCH_USER_ID", "").trim();
}

export function isMonarchUser(userId) {
  const monarchUserId = getMonarchUserId();

  if (!monarchUserId) {
    return false;
  }

  return String(userId || "") === monarchUserId;
}

export function checkEarlyAccess({ userId } = {}) {
  const monarchUserId = getMonarchUserId();

  if (!monarchUserId) {
    return {
      allowed: false,
      reason: "MONARCH_USER_ID is not configured.",
    };
  }

  if (!isMonarchUser(userId)) {
    return {
      allowed: false,
      reason: "Access is limited to the Monarch during SG 2.0 foundation.",
    };
  }

  return {
    allowed: true,
    reason: "Monarch access confirmed.",
  };
}
