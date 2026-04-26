// src/bot/handlers/pmCapabilitiesDiag.js
// ============================================================================
// PROJECT MEMORY CAPABILITIES DIAGNOSTIC HANDLER
// Stage: 7A.13 Project Capability Snapshot
//
// Purpose:
// - diagnose Project Capability Snapshot wiring
// - verify facts provider + factory + validator path
// - show read-only safety flags for Monarch
//
// Important:
// - This file has no DB writes.
// - This file does not write Project Memory.
// - This file does not read repo/runtime by itself.
// ============================================================================

import { truncateTelegramText } from "../telegram/telegramTextUtils.js";
import { createProjectCapabilitySnapshot } from "../../projectMemory/ProjectCapabilitySnapshotFactory.js";
import { getProjectCapabilitySnapshotFacts } from "../../projectMemory/ProjectCapabilitySnapshotFactsProvider.js";

export const PM_CAPABILITIES_DIAG_HANDLER_BUILD =
  "pm-capabilities-diag-handler-7A13-compact-2026-04-26-01";

export const PM_CAPABILITIES_DIAG_HANDLER_PATH =
  "src/bot/handlers/pmCapabilitiesDiag.js";

export async function handlePmCapabilitiesDiag({ bot, chatId }) {
  const input = getProjectCapabilitySnapshotFacts();
  const result = createProjectCapabilitySnapshot(input);
  const snapshot = result.snapshot;
  const validationErrors = Array.isArray(result.validation?.errors)
    ? result.validation.errors
    : [];

  const lines = [
    "🧪 PM Capabilities diag",
    "",
    `validation: ${result.validation?.ok ? "OK" : "FAILED"}`,
    `dbWrites: ${snapshot.evidence?.runtime?.dbWrites ? "yes" : "no"}`,
    `advisoryOnly: ${snapshot.advisoryOnly ? "yes" : "no"}`,
    `sourceOfTruth: ${snapshot.sourceOfTruth}`,
    `capabilities: ${Array.isArray(snapshot.capabilities) ? snapshot.capabilities.length : 0}`,
    `commands: ${Array.isArray(snapshot.evidence?.verifiedCommands) ? snapshot.evidence.verifiedCommands.length : 0}`,
    `files: ${Array.isArray(snapshot.evidence?.verifiedFiles) ? snapshot.evidence.verifiedFiles.length : 0}`,
    validationErrors.length > 0
      ? `firstError: ${validationErrors[0]}`
      : "errors: none",
    "",
    "Result: read-only path active.",
  ];

  await bot.sendMessage(chatId, truncateTelegramText(lines.join("\n")));
}

export default handlePmCapabilitiesDiag;
