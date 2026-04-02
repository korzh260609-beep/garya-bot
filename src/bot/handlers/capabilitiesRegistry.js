// src/bot/handlers/capabilitiesRegistry.js
// ============================================================================
// STAGE 12A.5 — CAPABILITY REGISTRY HANDLERS (SKELETON)
// Commands:
// - /capabilities
// - /capability <key|command>
// ============================================================================

import {
  CAPABILITY_REGISTRY_VERSION,
  listCapabilities,
  resolveCapability,
  buildCapabilityRegistrySummary,
} from "../../capabilities/capabilityRegistry.js";

async function requireMonarch(bot, chatId, userIdStr) {
  const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "").trim();
  if (!MONARCH_USER_ID) return true;

  if (String(userIdStr) !== MONARCH_USER_ID) {
    await bot.sendMessage(chatId, "⛔ Недостаточно прав (monarch-only).");
    return false;
  }

  return true;
}

function normalizeRest(rest) {
  return String(rest || "").trim();
}

function formatListText() {
  const summary = buildCapabilityRegistrySummary();
  const lines = [];

  lines.push("CAPABILITY REGISTRY");
  lines.push(`version: ${CAPABILITY_REGISTRY_VERSION}`);
  lines.push(`total: ${summary.total}`);
  lines.push("");

  for (const item of summary.items) {
    lines.push(`- ${item.key}`);
    lines.push(`  stage: ${item.stage}`);
    lines.push(`  status: ${item.status}`);
    lines.push(`  command: ${item.command}`);
    lines.push(`  readOnly: ${String(item.readOnly)}`);
    lines.push(`  autoExecute: ${String(item.autoExecute)}`);
    lines.push(`  fileOutput: ${String(item.fileOutput)}`);
  }

  lines.push("");
  lines.push("Usage:");
  lines.push("- /capabilities");
  lines.push("- /capability <key|command>");

  return lines.join("\n");
}

function formatSingleCapabilityText(capability) {
  const lines = [];

  lines.push("CAPABILITY");
  lines.push(`key: ${capability.key}`);
  lines.push(`title: ${capability.title}`);
  lines.push(`stage: ${capability.stage}`);
  lines.push(`status: ${capability.status}`);
  lines.push(`command: ${capability.command}`);
  lines.push(`readOnly: ${String(capability.readOnly === true)}`);
  lines.push(`autoExecute: ${String(capability.autoExecute === true)}`);
  lines.push(`fileOutput: ${String(capability.fileOutput === true)}`);
  lines.push("");

  lines.push("supportedRequests:");
  if (Array.isArray(capability.supportedRequests) && capability.supportedRequests.length) {
    for (const item of capability.supportedRequests) {
      lines.push(`- ${item}`);
    }
  } else {
    lines.push("- (none)");
  }

  lines.push("");
  lines.push("outputModes:");
  if (Array.isArray(capability.outputModes) && capability.outputModes.length) {
    for (const item of capability.outputModes) {
      lines.push(`- ${item}`);
    }
  } else {
    lines.push("- (none)");
  }

  lines.push("");
  lines.push("currentLimits:");
  if (Array.isArray(capability.currentLimits) && capability.currentLimits.length) {
    for (const item of capability.currentLimits) {
      lines.push(`- ${item}`);
    }
  } else {
    lines.push("- (none)");
  }

  lines.push("");
  lines.push(`notes: ${capability.notes || "n/a"}`);

  return lines.join("\n");
}

export async function handleCapabilitiesRegistry({ bot, chatId, senderIdStr }) {
  const effectiveUserIdStr = senderIdStr ? String(senderIdStr) : String(chatId);

  const ok = await requireMonarch(bot, chatId, effectiveUserIdStr);
  if (!ok) return;

  await bot.sendMessage(chatId, formatListText());
}

export async function handleCapabilityLookup({ bot, chatId, senderIdStr, rest }) {
  const effectiveUserIdStr = senderIdStr ? String(senderIdStr) : String(chatId);

  const ok = await requireMonarch(bot, chatId, effectiveUserIdStr);
  if (!ok) return;

  const query = normalizeRest(rest);
  if (!query) {
    await bot.sendMessage(chatId, "Usage: /capability <key|command>");
    return;
  }

  const capability = resolveCapability(query);
  if (!capability) {
    const known = listCapabilities().map((item) => item.key).join(", ");
    await bot.sendMessage(
      chatId,
      [
        "Capability not found.",
        `query: ${query}`,
        `known: ${known || "none"}`,
      ].join("\n")
    );
    return;
  }

  await bot.sendMessage(chatId, formatSingleCapabilityText(capability));
}

export default {
  handleCapabilitiesRegistry,
  handleCapabilityLookup,
};