// src/bot/handlers/pmCapabilities.js
// ============================================================================
// PROJECT MEMORY CAPABILITIES HANDLER
// Stage: 7A.13 Project Capability Snapshot
//
// Purpose:
// - render a read-only Project Capability snapshot for Telegram
// - explain practical SG abilities from supplied repo/runtime/test facts
// - keep command output advisory, not authoritative
//
// Important:
// - This file has no DB writes.
// - This file is wired into dispatcher as read-only command.
// - This file does not read repo/runtime by itself.
// - Caller must supply verified repo/runtime/test facts.
// ============================================================================

import { truncateTelegramText } from "../telegram/telegramTextUtils.js";
import { createProjectCapabilitySnapshot } from "../../projectMemory/ProjectCapabilitySnapshotFactory.js";

export const PM_CAPABILITIES_HANDLER_BUILD =
  "pm-capabilities-handler-7A13-compact-2026-04-26-01";

export const PM_CAPABILITIES_HANDLER_PATH =
  "src/bot/handlers/pmCapabilities.js";

function statusIcon(status) {
  if (status === "runtime_verified") return "✅";
  if (status === "read_only") return "👁️";
  if (status === "configured") return "⚙️";
  if (status === "skeleton") return "🦴";
  if (status === "blocked") return "⛔";
  return "•";
}

function formatCapabilities(snapshot) {
  const capabilities = Array.isArray(snapshot?.capabilities)
    ? snapshot.capabilities
    : [];

  if (capabilities.length === 0) {
    return ["• Возможности не переданы."];
  }

  return capabilities.flatMap((capability) => {
    const title = String(capability.title || capability.key || "Unknown capability");
    const status = String(capability.status || "unknown");
    const userBenefit = String(capability.userBenefit || "Польза не указана.");

    return [
      `${statusIcon(status)} ${title}`,
      `Польза: ${userBenefit}`,
      "",
    ];
  });
}

function formatValidation(validation) {
  if (validation?.ok) {
    return "Validation: OK";
  }

  const errors = Array.isArray(validation?.errors) ? validation.errors : [];
  const firstError = errors[0] || "unknown validation error";

  return `Validation: FAILED — ${firstError}`;
}

export async function handlePmCapabilities({
  bot,
  chatId,
  input = {},
}) {
  const result = createProjectCapabilitySnapshot(input);
  const snapshot = result.snapshot;

  const lines = [
    "🧠 Возможности СГ",
    "",
    `Источник истины: ${snapshot.sourceOfTruth}`,
    `Snapshot: ${snapshot.advisoryOnly ? "справочный" : "основной"}`,
    "",
    "Текущие возможности:",
    ...formatCapabilities(snapshot),
    formatValidation(result.validation),
    "",
    `Next: ${snapshot.nextSafeStep || "следующий шаг не указан"}`,
  ];

  await bot.sendMessage(chatId, truncateTelegramText(lines.join("\n")));
}

export default handlePmCapabilities;
