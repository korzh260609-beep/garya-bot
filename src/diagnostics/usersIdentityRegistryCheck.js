// AGENT NOTE:
// SG 2.0 users identity registry diagnostic check.
// Purpose: verify the durable globalUserId registry through the diagnostics layer without adding transport commands.
// Do not add Telegram slash commands, AI calls, repo writes, memory writes, or raw provider ID output here.

import { isDatabaseConfigured } from "../db/postgresClient.js";
import { getMonarchUserId } from "../permissions/monarchGate.js";
import { resolveIdentityAsync } from "../users/identityResolver.js";
import { isDurableGlobalUserId, USER_ROLES } from "../users/globalIdentity.js";
import { resolveOrCreateGlobalUserIdentity } from "../users/userRegistryStore.js";

const DIAGNOSTIC_PROVIDER = "api";
const DIAGNOSTIC_PROVIDER_USER_ID = "users_identity_registry_selfcheck";

function buildSafeResult(data = {}) {
  return {
    ok: Boolean(data.ok),
    type: "users_identity_registry",
    databaseConfigured: Boolean(data.databaseConfigured),
    monarchGateConfigured: Boolean(data.monarchGateConfigured),
    fallbackSafe: Boolean(data.fallbackSafe),
    monarchStable: Boolean(data.monarchStable),
    durableModeChecked: Boolean(data.durableModeChecked),
    stableGlobalUserId: Boolean(data.stableGlobalUserId),
    globalUserIdShapeOk: Boolean(data.globalUserIdShapeOk),
    identityStatus: data.identityStatus || null,
    rawProviderUserIdExposed: false,
    summary: data.summary || "Users identity registry check completed.",
    error: data.error || null,
  };
}

async function checkFallbackAndMonarch() {
  const fallbackIdentity = await resolveIdentityAsync({
    transport: DIAGNOSTIC_PROVIDER,
    userId: null,
  });
  const monarchUserId = getMonarchUserId();
  const monarchGateConfigured = Boolean(monarchUserId);

  if (!monarchGateConfigured) {
    return {
      fallbackSafe: fallbackIdentity?.identityRegistry?.ok === false,
      monarchGateConfigured,
      monarchStable: false,
    };
  }

  const monarchIdentity = await resolveIdentityAsync({
    transport: DIAGNOSTIC_PROVIDER,
    userId: monarchUserId,
  });

  return {
    fallbackSafe: fallbackIdentity?.identityRegistry?.ok === false,
    monarchGateConfigured,
    monarchStable: monarchIdentity?.globalUserId === "usr_48cc07c069030fb3"
      && monarchIdentity?.role === USER_ROLES.MONARCH
      && isDurableGlobalUserId(monarchIdentity?.globalUserId),
  };
}

async function checkDurableRegistry() {
  const first = await resolveOrCreateGlobalUserIdentity({
    provider: DIAGNOSTIC_PROVIDER,
    providerUserId: DIAGNOSTIC_PROVIDER_USER_ID,
    isMonarch: false,
    metadata: {
      source: "usersIdentityRegistryCheck",
      purpose: "diagnostic_selfcheck",
    },
  });

  const second = await resolveOrCreateGlobalUserIdentity({
    provider: DIAGNOSTIC_PROVIDER,
    providerUserId: DIAGNOSTIC_PROVIDER_USER_ID,
    isMonarch: false,
    metadata: {
      source: "usersIdentityRegistryCheck",
      purpose: "diagnostic_selfcheck_repeat",
    },
  });

  const firstGlobalUserId = first?.globalUserId || "";
  const secondGlobalUserId = second?.globalUserId || "";

  return {
    durableModeChecked: true,
    stableGlobalUserId: Boolean(firstGlobalUserId) && firstGlobalUserId === secondGlobalUserId,
    globalUserIdShapeOk: isDurableGlobalUserId(firstGlobalUserId),
    identityStatus: second?.identityStatus || first?.identityStatus || null,
    ok: Boolean(first?.ok && second?.ok),
    reason: first?.reason || second?.reason || null,
  };
}

export async function runUsersIdentityRegistryCheck() {
  try {
    const databaseConfigured = isDatabaseConfigured();
    const base = await checkFallbackAndMonarch();
    const monarchOkOrSkipped = base.monarchGateConfigured ? base.monarchStable : true;

    if (!databaseConfigured) {
      return buildSafeResult({
        ok: base.fallbackSafe && monarchOkOrSkipped,
        databaseConfigured,
        ...base,
        durableModeChecked: false,
        stableGlobalUserId: false,
        globalUserIdShapeOk: false,
        identityStatus: "fallback_no_database",
        summary: base.monarchGateConfigured
          ? "Users identity registry fallback and Monarch identity are safe; DATABASE_URL is not configured for durable DB check."
          : "Users identity registry fallback is safe; DATABASE_URL and MONARCH_USER_ID are not configured for full runtime check.",
      });
    }

    const durable = await checkDurableRegistry();
    const ok = base.fallbackSafe
      && monarchOkOrSkipped
      && durable.ok
      && durable.stableGlobalUserId
      && durable.globalUserIdShapeOk;

    return buildSafeResult({
      ok,
      databaseConfigured,
      ...base,
      ...durable,
      summary: ok
        ? "Users identity registry durable check passed."
        : `Users identity registry durable check failed: ${durable.reason || "unknown_reason"}`,
      error: ok ? null : durable.reason || "users_identity_registry_failed",
    });
  } catch (error) {
    return buildSafeResult({
      ok: false,
      error: error?.message || "users_identity_registry_check_failed",
      summary: error?.message || "Users identity registry check failed.",
    });
  }
}

export default {
  runUsersIdentityRegistryCheck,
};
