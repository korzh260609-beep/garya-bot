// AGENT NOTE:
// SG 2.0 minimal identity resolver.
// Purpose: map platform-specific user data into a stable internal user shape.
// Do not make provider IDs the permanent identity root or expand this into full profiles/roles without approved users/permissions skeleton.

import { isMonarchUser } from "../permissions/monarchGate.js";
import {
  buildProviderIdentityRef,
  resolveKnownGlobalUserId,
  USER_ROLES,
} from "./globalIdentity.js";

export function resolveIdentity(context = {}) {
  const providerIdentity = buildProviderIdentityRef({
    provider: context.transport || "unknown",
    providerUserId: context.userId || context.senderId || null,
  });
  const isMonarch = isMonarchUser(providerIdentity.providerUserId);

  return {
    globalUserId: resolveKnownGlobalUserId({
      isMonarch,
      provider: providerIdentity.provider,
      providerUserId: providerIdentity.providerUserId,
    }),
    platform: providerIdentity.provider,
    platformUserId: providerIdentity.providerUserId === "unknown" ? null : providerIdentity.providerUserId,
    role: isMonarch ? USER_ROLES.MONARCH : USER_ROLES.GUEST,
    displayName: isMonarch ? "Гарик / GARY" : "гость",
    isMonarch,
    identityProvider: providerIdentity.provider,
    identityStatus: isMonarch ? "stable" : "pending_registry",
  };
}
