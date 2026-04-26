// src/core/commandPolicy/CommandPolicyShadowStore.js
// ============================================================================
// STAGE 7A — Command Policy Shadow Store
// Purpose:
// - keep the latest command policy shadow result in process memory
// - support lightweight diagnostics without reading Render logs manually
// - do NOT enforce access here
// - do NOT persist secrets here
//
// Boundary:
// - this is a technical diagnostic buffer only
// - normal SG conversation remains natural-language driven
// - slash commands are only explicit system/admin/diagnostic controls
// ============================================================================

const MAX_SHADOW_HISTORY = 20;

let lastCommandPolicyShadow = null;
let commandPolicyShadowHistory = [];

function clonePlain(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch (_e) {
    return null;
  }
}

export function recordCommandPolicyShadow(input = {}) {
  const entry = {
    ...clonePlain(input),
    recordedAt: new Date().toISOString(),
  };

  lastCommandPolicyShadow = entry;
  commandPolicyShadowHistory = [entry, ...commandPolicyShadowHistory].slice(0, MAX_SHADOW_HISTORY);

  return clonePlain(entry);
}

export function getLastCommandPolicyShadow() {
  return clonePlain(lastCommandPolicyShadow);
}

export function getCommandPolicyShadowHistory({ limit = 5 } = {}) {
  const n = Number.isFinite(Number(limit)) ? Number(limit) : 5;
  return clonePlain(commandPolicyShadowHistory.slice(0, Math.max(1, Math.min(n, MAX_SHADOW_HISTORY))));
}

export function formatCommandPolicyShadowLast(entry = getLastCommandPolicyShadow()) {
  if (!entry) {
    return [
      "Command Policy Shadow Last",
      "status: empty",
      "reason: no shadow entries recorded in current process",
    ].join("\n");
  }

  return [
    "Command Policy Shadow Last",
    `recordedAt: ${entry.recordedAt || "unknown"}`,
    `cmd: ${entry.cmd || "unknown"}`,
    `transport: ${entry.transport || "unknown"}`,
    `chatType: ${entry.chatType || "unknown"}`,
    `isPrivate: ${String(entry.isPrivate === true)}`,
    `isMonarch: ${String(entry.isMonarch === true)}`,
    `bypass: ${String(entry.bypass === true)}`,
    `legacyPrivateOnly: ${String(entry.legacyPrivateOnly === true)}`,
    `legacyPrivateBlocked: ${String(entry.legacyPrivateBlocked === true)}`,
    `policyAllowed: ${String(entry.policyAllowed === true)}`,
    `policyBlocked: ${String(entry.policyBlocked === true)}`,
    `policyReason: ${entry.policyReason || "null"}`,
    `policyScope: ${entry.policyScope || "null"}`,
    `privateGateMatches: ${String(entry.privateGateMatches === true)}`,
    `policyHasKnownCommand: ${String(entry.policyHasKnownCommand === true)}`,
    `shadowMismatch: ${String(entry.shadowMismatch === true)}`,
    `shadowOnly: ${String(entry.shadowOnly === true)}`,
  ].join("\n");
}

export default {
  recordCommandPolicyShadow,
  getLastCommandPolicyShadow,
  getCommandPolicyShadowHistory,
  formatCommandPolicyShadowLast,
};
