// scripts/smokeLegacyProjectIntentFlowSkeleton.js
// ============================================================================
// LEGACY PROJECT INTENT FLOW SKELETON SMOKE CHECK
//
// Purpose:
// - verify the disconnected legacyProjectIntentFlow skeleton imports;
// - verify it does not handle, execute, write, or add diagnostics;
// - verify it remains a migration boundary, not a new Technical Mode layer.
// ============================================================================

import {
  createLegacyProjectIntentFlowInput,
  handleLegacyProjectIntentFlow,
  LEGACY_PROJECT_INTENT_FLOW_STATUS,
} from "../src/core/handleMessage/legacyProjectIntentFlow.js";

function assertFunction(name, value) {
  if (typeof value !== "function") {
    throw new Error(`legacyProjectIntentFlow smoke check failed: ${name} is not a function`);
  }
}

function assertEqual(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`legacyProjectIntentFlow smoke check failed: ${name}: expected ${expected}, got ${actual}`);
  }
}

assertFunction("createLegacyProjectIntentFlowInput", createLegacyProjectIntentFlowInput);
assertFunction("handleLegacyProjectIntentFlow", handleLegacyProjectIntentFlow);

const normalized = createLegacyProjectIntentFlowInput({
  trimmed: "проверь репозиторий",
  transport: "telegram",
  chatIdStr: "123",
  chatType: "private",
  globalUserId: "gary",
  senderId: "gary-telegram",
  messageId: 777,
  isPrivateChat: true,
  isMonarchUser: true,
  userRole: "monarch",
});

assertEqual("normalized.text", normalized.text, "проверь репозиторий");
assertEqual("normalized.transport", normalized.transport, "telegram");
assertEqual("normalized.chatId", normalized.chatId, "123");
assertEqual("normalized.isPrivateChat", normalized.isPrivateChat, true);
assertEqual("normalized.isMonarchUser", normalized.isMonarchUser, true);

const result = await handleLegacyProjectIntentFlow(normalized);

assertEqual("result.ok", result.ok, true);
assertEqual("result.handled", result.handled, false);
assertEqual("result.dryRun", result.dryRun, true);
assertEqual("result.status", result.status, LEGACY_PROJECT_INTENT_FLOW_STATUS.DISCONNECTED);
assertEqual("result.metadata.noRuntimeConnection", result.metadata.noRuntimeConnection, true);
assertEqual("result.metadata.noSlashCommandsAdded", result.metadata.noSlashCommandsAdded, true);
assertEqual("result.metadata.noTechnicalModeExpansion", result.metadata.noTechnicalModeExpansion, true);
assertEqual("result.metadata.noDiagnosticBridgeAdded", result.metadata.noDiagnosticBridgeAdded, true);
assertEqual("result.metadata.noProjectIntentExecution", result.metadata.noProjectIntentExecution, true);
assertEqual("result.metadata.noStateChange", result.metadata.noStateChange, true);
assertEqual("result.projectIntentRepoContext", result.projectIntentRepoContext, null);
assertEqual("result.projectContextDecision", result.projectContextDecision, null);
assertEqual("result.projectMemoryAutoCaptureSummary", result.projectMemoryAutoCaptureSummary, null);

console.log("OK: legacyProjectIntentFlow disconnected skeleton contract is valid.");
