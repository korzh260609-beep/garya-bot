// AGENT NOTE:
// SG 2.0 minimal identity resolver.
// Purpose: map platform-specific Telegram user data into a stable internal user shape.
// Do not make Telegram ID the permanent identity root or expand this into full profiles/roles without approved users/permissions skeleton.

import { isMonarchUser } from "../permissions/monarchGate.js";

export function resolveIdentity(context = {}) {
  const platform = context.transport || "unknown";
  const platformUserId = context.userId || context.senderId || null;
  const isMonarch = isMonarchUser(platformUserId);

  return {
    globalUserId: isMonarch ? "monarch:garya" : `pending:${platform}:${platformUserId || "unknown"}`,
    platform,
    platformUserId: platformUserId ? String(platformUserId) : null,
    role: isMonarch ? "monarch" : "guest",
    displayName: isMonarch ? "Гарик / GARY" : "гость",
    isMonarch,
  };
}
