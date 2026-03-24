// src/core/buildLongTermPromptSelector.js
//
// Goal:
// - define deterministic long-term memory selector for prompt retrieval
// - keep selection policy OUTSIDE bridges/prompts
// - no DB
// - no side effects
// - deterministic only
//
// IMPORTANT:
// - this helper does NOT read memory by itself
// - this helper does NOT call MemoryService
// - this helper only returns selector config for selectLongTermContext()
//
// STAGE 11.x:
// - add domain / slot / domainSlot selector support
// - keep backward compatibility with rememberKeys / rememberTypes

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeStrList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();

  for (const item of values) {
    const s = safeStr(item).trim();
    if (!s) continue;

    const dedupeKey = s.toLowerCase();
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    out.push(s);
  }

  return out;
}

function normalizeDomainSlotList(values) {
  if (!Array.isArray(values)) return [];

  const out = [];
  const seen = new Set();

  for (const item of values) {
    const rememberDomain = safeStr(item?.rememberDomain).trim();
    const rememberSlot = safeStr(item?.rememberSlot).trim();

    if (!rememberDomain || !rememberSlot) continue;

    const dedupeKey = `${rememberDomain.toLowerCase()}::${rememberSlot.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    out.push({
      rememberDomain,
      rememberSlot,
    });
  }

  return out;
}

function normalizePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.trunc(n);
}

export function buildLongTermPromptSelector({
  rememberKeys = null,
  rememberTypes = null,
  rememberDomains = null,
  rememberSlots = null,
  domainSlots = null,
  perKeyLimit = null,
  perTypeLimit = null,
  perDomainLimit = null,
  perSlotLimit = null,
  perDomainSlotLimit = null,
  totalLimit = null,
} = {}) {
  const defaultRememberKeys = normalizeStrList([
    "name",
    "communication_style",
  ]);

  const defaultRememberTypes = normalizeStrList([
    "identity_profile",
    "user_preference",
  ]);

  const defaultRememberDomains = normalizeStrList([
    "identity",
    "user_preference",
  ]);

  const defaultRememberSlots = normalizeStrList([
    "name",
    "communication_style",
  ]);

  const defaultDomainSlots = normalizeDomainSlotList([
    { rememberDomain: "identity", rememberSlot: "name" },
    { rememberDomain: "user_preference", rememberSlot: "communication_style" },
  ]);

  const finalRememberKeys =
    Array.isArray(rememberKeys) && rememberKeys.length > 0
      ? normalizeStrList(rememberKeys)
      : defaultRememberKeys;

  const finalRememberTypes =
    Array.isArray(rememberTypes) && rememberTypes.length > 0
      ? normalizeStrList(rememberTypes)
      : defaultRememberTypes;

  const finalRememberDomains =
    Array.isArray(rememberDomains) && rememberDomains.length > 0
      ? normalizeStrList(rememberDomains)
      : defaultRememberDomains;

  const finalRememberSlots =
    Array.isArray(rememberSlots) && rememberSlots.length > 0
      ? normalizeStrList(rememberSlots)
      : defaultRememberSlots;

  const finalDomainSlots =
    Array.isArray(domainSlots) && domainSlots.length > 0
      ? normalizeDomainSlotList(domainSlots)
      : defaultDomainSlots;

  const finalPerKeyLimit = normalizePositiveInt(perKeyLimit, 2);
  const finalPerTypeLimit = normalizePositiveInt(perTypeLimit, 2);
  const finalPerDomainLimit = normalizePositiveInt(perDomainLimit, 2);
  const finalPerSlotLimit = normalizePositiveInt(perSlotLimit, 2);
  const finalPerDomainSlotLimit = normalizePositiveInt(perDomainSlotLimit, 2);
  const finalTotalLimit = normalizePositiveInt(totalLimit, 4);

  return {
    rememberKeys: finalRememberKeys,
    rememberTypes: finalRememberTypes,
    rememberDomains: finalRememberDomains,
    rememberSlots: finalRememberSlots,
    domainSlots: finalDomainSlots,
    perKeyLimit: finalPerKeyLimit,
    perTypeLimit: finalPerTypeLimit,
    perDomainLimit: finalPerDomainLimit,
    perSlotLimit: finalPerSlotLimit,
    perDomainSlotLimit: finalPerDomainSlotLimit,
    totalLimit: finalTotalLimit,
  };
}

export default buildLongTermPromptSelector;