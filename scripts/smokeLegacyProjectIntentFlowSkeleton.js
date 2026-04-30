// scripts/smokeLegacyProjectIntentFlowSkeleton.js
// ============================================================================
// LEGACY PROJECT INTENT FLOW BOUNDARY SMOKE CHECK
//
// Purpose:
// - verify legacyProjectIntentFlow boundary imports;
// - verify input normalization;
// - verify the safe continue-phase failure path without external calls;
// - verify this remains an isolation boundary, not a new Technical Mode layer.
// ============================================================================

import {
  createLegacyProjectIntentFlowInput,
  handleLegacyProjectIntentFlow,
  LEGACY_PROJECT_INTENT_FLOW_PHASE,
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

assertEqual("phase.prepare", LEGACY_PROJECT_INTENT_FLOW_PHASE.PREPARE, "prepare");
assertEqual("phase.continue", LEGACY_PROJECT_INTENT_FLOW_PHASE.CONTINUE, "continue");
assertEqual("status.prepared", LEGACY_PROJECT_INTENT_FLOW_STATUS.PREPARED, "prepared");
assertEqual("status.handled", LEGACY_PROJECT_INTENT_FLOW_STATUS.HANDLED, "handled");
assertEqual("status.not_handled", LEGACY_PROJECT_INTENT_FLOW_STATUS.NOT_HANDLED, "not_handled");
assertEqual("status.blocked", LEGACY_PROJECT_INTENT_FLOW_STATUS.BLOCKED, "blocked");

const normalized = createLegacyProjectIntentFlowInput({
  phase: LEGACY_PROJECT_INTENT_FLOW_PHASE.CONTINUE,
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

assertEqual("normalized.phase", normalized.phase, LEGACY_PROJECT_INTENT_FLOW_PHASE.CONTINUE);
assertEqual("normalized.text", normalized.text, "проверь репозиторий");
assertEqual("normalized.transport", normalized.transport, "telegram");
assertEqual("normalized.chatId", normalized.chatId, "123");
assertEqual("normalized.chatIdStr", normalized.chatIdStr, "123");
assertEqual("normalized.isPrivateChat", normalized.isPrivateChat, true);
assertEqual("normalized.isMonarchUser", normalized.isMonarchUser, true);

const safeMissingPreparedResult = await handleLegacyProjectIntentFlow(normalized);

assertEqual("safeMissingPreparedResult.ok", safeMissingPreparedResult.ok, false);
assertEqual("safeMissingPreparedResult.handled", safeMissingPreparedResult.handled, false);
assertEqual("safeMissingPreparedResult.status", safeMissingPreparedResult.status, LEGACY_PROJECT_INTENT_FLOW_STATUS.BLOCKED);
assertEqual(
  "safeMissingPreparedResult.reason",
  safeMissingPreparedResult.reason,
  "missing_prepared_legacy_project_intent_flow"
);

console.log("OK: legacyProjectIntentFlow boundary imports and safe contract are valid.");
