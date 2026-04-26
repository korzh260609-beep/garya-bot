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
// - This file is not wired into dispatcher yet.
// - This file does not read repo/runtime by itself.
// - Caller must supply verified repo/runtime/test facts.
// ============================================================================

import { truncateTelegramText } from "../telegram/telegramTextUtils.js";
import { createProjectCapabilitySnapshot } from "../../projectMemory/ProjectCapabilitySnapshotFactory.js";

export const PM_CAPABILITIES_HANDLER_BUILD =
  "pm-capabilities-handler-7A13-skeleton-2026-04-26-01";

export const PM_CAPABILITIES_HANDLER_PATH =
  "src/bot/handlers/pmCapabilities.js";

function formatCapabilities(snapshot) {
  const capabilities = Array.isArray(snapshot?.capabilities)
    ? snapshot.capabilities
    : [];

  if (capabilities.length === 0) {
    return ["• Нет переданных capability facts для отображения."];
  }

  return capabilities.map((capability) => {
    const title = String(capability.title || capability.key || "Unknown capability");
    const status = String(capability.status || "unknown");
    const userBenefit = String(capability.userBenefit || "Практическая польза не указана.");

    return `• ${title}\n  status: ${status}\n  benefit: ${userBenefit}`;
  });
}

function formatValidation(validation) {
  if (validation?.ok) {
    return ["validation: OK"];
  }

  const errors = Array.isArray(validation?.errors) ? validation.errors : [];

  if (errors.length === 0) {
    return ["validation: FAILED", "- unknown validation error"];
  }

  return ["validation: FAILED", ...errors.map((error) => `- ${error}`)];
}

export async function handlePmCapabilities({
  bot,
  chatId,
  input = {},
}) {
  const result = createProjectCapabilitySnapshot(input);
  const snapshot = result.snapshot;

  const lines = [
    "🧠 Project Capability Snapshot",
    "",
    `build: ${PM_CAPABILITIES_HANDLER_BUILD}`,
    `handlerPath: ${PM_CAPABILITIES_HANDLER_PATH}`,
    `factoryVersion: ${result.factoryVersion}`,
    "",
    `sourceOfTruth: ${snapshot.sourceOfTruth}`,
    `advisoryOnly: ${snapshot.advisoryOnly ? "yes" : "no"}`,
    `snapshotType: ${snapshot.snapshotType}`,
    `stage: ${snapshot.project?.stageKey || "unknown"}`,
    "",
    snapshot.notice,
    "",
    "Capabilities:",
    ...formatCapabilities(snapshot),
    "",
    "Validation:",
    ...formatValidation(result.validation),
  ];

  await bot.sendMessage(chatId, truncateTelegramText(lines.join("\n")));
}

export default handlePmCapabilities;
