// AGENT NOTE:
// SG 2.0 global identity contract helpers.
// Purpose: keep internal SG user identity separate from provider-specific IDs.
// Do not add database queries, Telegram transport logic, billing, memory writes, or permissions expansion here.

export const GLOBAL_USER_ID_PREFIX = "usr_";
export const MONARCH_GLOBAL_USER_ID = "monarch:garya";
export const UNKNOWN_GLOBAL_USER_ID = "unknown:anonymous";

export const USER_ROLES = Object.freeze({
  MONARCH: "monarch",
  CITIZEN: "citizen",
  GUEST: "guest",
  SYSTEM: "system",
  UNKNOWN: "unknown",
});

export const IDENTITY_PROVIDERS = Object.freeze({
  TELEGRAM: "telegram",
  WEB: "web",
  API: "api",
  SYSTEM: "system",
  UNKNOWN: "unknown",
});

function normalizeText(value, fallback = "") {
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return text || fallback;
}

export function normalizeIdentityProvider(provider) {
  const normalized = normalizeText(provider, IDENTITY_PROVIDERS.UNKNOWN).toLowerCase();
  return Object.values(IDENTITY_PROVIDERS).includes(normalized) ? normalized : IDENTITY_PROVIDERS.UNKNOWN;
}

export function normalizeProviderUserId(providerUserId) {
  return normalizeText(providerUserId, "unknown");
}

export function buildPendingGlobalUserId({ provider, providerUserId } = {}) {
  const normalizedProvider = normalizeIdentityProvider(provider);
  const normalizedProviderUserId = normalizeProviderUserId(providerUserId);
  return `pending:${normalizedProvider}:${normalizedProviderUserId}`;
}

export function resolveKnownGlobalUserId({ isMonarch = false, provider, providerUserId } = {}) {
  if (isMonarch) return MONARCH_GLOBAL_USER_ID;
  return buildPendingGlobalUserId({ provider, providerUserId });
}

export function isMonarchGlobalUserId(globalUserId) {
  return normalizeText(globalUserId) === MONARCH_GLOBAL_USER_ID;
}

export function isPendingGlobalUserId(globalUserId) {
  return normalizeText(globalUserId).startsWith("pending:");
}

export function isDurableGlobalUserId(globalUserId) {
  const normalized = normalizeText(globalUserId);
  return normalized === MONARCH_GLOBAL_USER_ID || normalized.startsWith(GLOBAL_USER_ID_PREFIX);
}

export function buildProviderIdentityRef({ provider, providerUserId } = {}) {
  return {
    provider: normalizeIdentityProvider(provider),
    providerUserId: normalizeProviderUserId(providerUserId),
  };
}
