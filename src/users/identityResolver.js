// AGENT NOTE:
// SG 2.0 identity resolver.
// Purpose: map platform-specific user data into a stable internal user shape.
// Do not make provider IDs the permanent identity root or expand this into full profiles/roles without approved users/permissions skeleton.

import { isMonarchUser } from "../permissions/monarchGate.js";
import {
  buildProviderIdentityRef,
  resolveKnownGlobalUserId,
  USER_ROLES,
} from "./globalIdentity.js";
import { resolveOrCreateGlobalUserIdentity } from "./userRegistryStore.js";

function buildFallbackIdentity({ providerIdentity, isMonarch, reason = "pending_registry" } = {}) {
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
    identityStatus: isMonarch ? "stable" : reason,
    identityRegistry: {
      ok: false,
      reason,
    },
  };
}

export function resolveIdentity(context = {}) {
  const providerIdentity = buildProviderIdentityRef({
    provider: context.transport || "unknown",
    providerUserId: context.userId || context.senderId || null,
  });
  const isMonarch = isMonarchUser(providerIdentity.providerUserId);

  return buildFallbackIdentity({ providerIdentity, isMonarch });
}

export async function resolveIdentityAsync(context = {}) {
  const providerIdentity = buildProviderIdentityRef({
    provider: context.transport || "unknown",
    providerUserId: context.userId || context.senderId || null,
  });
  const isMonarch = isMonarchUser(providerIdentity.providerUserId);
  const fallback = buildFallbackIdentity({ providerIdentity, isMonarch });

  try {
    const registry = await resolveOrCreateGlobalUserIdentity({
      provider: providerIdentity.provider,
      providerUserId: providerIdentity.providerUserId,
      isMonarch,
      metadata: {
        source: "identityResolver",
      },
    });

    if (!registry.ok || !registry.globalUserId) {
      return {
        ...fallback,
        identityRegistry: {
          ok: false,
          reason: registry.reason || "users_registry_unavailable",
        },
      };
    }

    return {
      ...fallback,
      globalUserId: registry.globalUserId,
      identityStatus: registry.identityStatus || "durable",
      identityRegistry: {
        ok: true,
        created: Boolean(registry.created),
      },
    };
  } catch (error) {
    return {
      ...fallback,
      identityRegistry: {
        ok: false,
        reason: error?.message || "identity_registry_failed",
      },
    };
  }
}
