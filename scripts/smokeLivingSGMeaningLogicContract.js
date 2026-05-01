// scripts/smokeLivingSGMeaningLogicContract.js
// ============================================================================
// LIVING SG MEANING/LOGIC CONTRACT SMOKE CHECK
//
// Purpose:
// - verify Living SG skeleton follows meaning -> intent -> capability -> gate -> response;
// - verify meaning is stronger than keyword/command-looking text;
// - verify memory-like state-changing paths request confirmation and do not execute;
// - verify no tools, commands, diagnostics, repo reads or memory writes are connected.
// ============================================================================

import { createLivingSGBoundary } from "../src/core/living-sg/LivingSGBoundary.js";

function assertEqual(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`Living SG meaning/logic contract failed: ${name}: expected ${expected}, got ${actual}`);
  }
}

function assertArrayIncludes(name, value, expectedPart) {
  if (!Array.isArray(value) || !value.includes(expectedPart)) {
    throw new Error(`Living SG meaning/logic contract failed: ${name}: missing ${expectedPart}`);
  }
}

function assertNotArrayIncludes(name, value, forbiddenPart) {
  if (Array.isArray(value) && value.includes(forbiddenPart)) {
    throw new Error(`Living SG meaning/logic contract failed: ${name}: forbidden ${forbiddenPart}`);
  }
}

function assertBoundarySafety(name, boundary) {
  assertEqual(`${name}.dryRun`, boundary?.dryRun, true);
  assertEqual(`${name}.connectedToRuntime`, boundary?.connectedToRuntime, false);
  assertEqual(`${name}.responsePlan.shouldExecuteTool`, boundary?.responsePlan?.shouldExecuteTool, false);
  assertEqual(`${name}.metadata.noSlashCommandsAdded`, boundary?.metadata?.noSlashCommandsAdded, true);
  assertEqual(`${name}.metadata.noTechnicalModeExpansion`, boundary?.metadata?.noTechnicalModeExpansion, true);
  assertEqual(`${name}.metadata.noDiagnosticBridge`, boundary?.metadata?.noDiagnosticBridge, true);
  assertEqual(`${name}.metadata.noProjectIntentExecution`, boundary?.metadata?.noProjectIntentExecution, true);
  assertEqual(`${name}.metadata.noStateChange`, boundary?.metadata?.noStateChange, true);
}

const projectMeaningBoundary = createLivingSGBoundary({
  text: "где мы сейчас по проекту?",
  transport: "telegram",
  chatIdStr: "123",
  globalUserId: "gary",
  senderId: "gary-telegram",
  isPrivateChat: true,
  isMonarchUser: true,
  userRole: "monarch",
  coreMeaning: {
    domain: "project",
    intent: "project_message",
    suggestedAction: "answer",
    confidence: "high",
  },
});

assertBoundarySafety("projectMeaningBoundary", projectMeaningBoundary);
assertEqual("projectMeaningBoundary.ok", projectMeaningBoundary.ok, true);
assertEqual("projectMeaningBoundary.intentKind", projectMeaningBoundary.intentPlan.intentKind, "project_thinking");
assertArrayIncludes("projectMeaningBoundary.capabilities", projectMeaningBoundary.capabilityPlan.capabilities, "think");
assertArrayIncludes("projectMeaningBoundary.capabilities", projectMeaningBoundary.capabilityPlan.capabilities, "analyze");
assertArrayIncludes("projectMeaningBoundary.capabilities", projectMeaningBoundary.capabilityPlan.capabilities, "prepare_proposal");
assertEqual("projectMeaningBoundary.actionType", projectMeaningBoundary.capabilityPlan.actionType, "read_only");
assertEqual("projectMeaningBoundary.gate", projectMeaningBoundary.gate.status, "allow_read_only");
assertEqual("projectMeaningBoundary.responseKind", projectMeaningBoundary.responsePlan.responseKind, "answer");

const memoryMeaningBoundary = createLivingSGBoundary({
  text: "запомни это как правило проекта",
  transport: "telegram",
  chatIdStr: "123",
  globalUserId: "gary",
  senderId: "gary-telegram",
  isPrivateChat: true,
  isMonarchUser: true,
  userRole: "monarch",
  coreMeaning: {
    domain: "memory",
    intent: "memory_change_request",
    suggestedAction: "remember",
    confidence: "high",
  },
});

assertBoundarySafety("memoryMeaningBoundary", memoryMeaningBoundary);
assertEqual("memoryMeaningBoundary.intentKind", memoryMeaningBoundary.intentPlan.intentKind, "memory_thinking");
assertArrayIncludes("memoryMeaningBoundary.capabilities", memoryMeaningBoundary.capabilityPlan.capabilities, "think");
assertArrayIncludes("memoryMeaningBoundary.capabilities", memoryMeaningBoundary.capabilityPlan.capabilities, "memory_proposal");
assertEqual("memoryMeaningBoundary.actionType", memoryMeaningBoundary.capabilityPlan.actionType, "needs_confirmation");
assertEqual("memoryMeaningBoundary.requiresConfirmation", memoryMeaningBoundary.capabilityPlan.requiresConfirmation, true);
assertEqual("memoryMeaningBoundary.gate", memoryMeaningBoundary.gate.status, "needs_confirmation");
assertEqual("memoryMeaningBoundary.gate.canChangeState", memoryMeaningBoundary.gate.canChangeState, false);
assertEqual("memoryMeaningBoundary.responseKind", memoryMeaningBoundary.responsePlan.responseKind, "confirmation_request");
assertEqual("memoryMeaningBoundary.responsePlan.shouldCallAI", memoryMeaningBoundary.responsePlan.shouldCallAI, false);

const commandLookingButGeneralMeaningBoundary = createLivingSGBoundary({
  text: "/repo_status",
  transport: "telegram",
  chatIdStr: "123",
  globalUserId: "gary",
  senderId: "gary-telegram",
  isPrivateChat: true,
  isMonarchUser: true,
  userRole: "monarch",
  coreMeaning: {
    domain: "general",
    intent: "general_question",
    suggestedAction: "answer",
    confidence: "high",
  },
});

assertBoundarySafety("commandLookingButGeneralMeaningBoundary", commandLookingButGeneralMeaningBoundary);
assertEqual("commandLookingButGeneralMeaningBoundary.intentKind", commandLookingButGeneralMeaningBoundary.intentPlan.intentKind, "general_response");
assertNotArrayIncludes("commandLookingButGeneralMeaningBoundary.capabilities", commandLookingButGeneralMeaningBoundary.capabilityPlan.capabilities, "prepare_proposal");
assertEqual("commandLookingButGeneralMeaningBoundary.actionType", commandLookingButGeneralMeaningBoundary.capabilityPlan.actionType, "read_only");
assertEqual("commandLookingButGeneralMeaningBoundary.responseKind", commandLookingButGeneralMeaningBoundary.responsePlan.responseKind, "answer");

const clarificationMeaningBoundary = createLivingSGBoundary({
  text: "проверь это",
  transport: "telegram",
  chatIdStr: "123",
  globalUserId: "gary",
  senderId: "gary-telegram",
  isPrivateChat: true,
  isMonarchUser: true,
  userRole: "monarch",
  coreMeaning: {
    domain: "unknown",
    intent: "unclear",
    suggestedAction: "clarify",
    confidence: "low",
  },
});

assertBoundarySafety("clarificationMeaningBoundary", clarificationMeaningBoundary);
assertEqual("clarificationMeaningBoundary.intentKind", clarificationMeaningBoundary.intentPlan.intentKind, "clarify");
assertArrayIncludes("clarificationMeaningBoundary.capabilities", clarificationMeaningBoundary.capabilityPlan.capabilities, "clarify");
assertEqual("clarificationMeaningBoundary.actionType", clarificationMeaningBoundary.capabilityPlan.actionType, "read_only");
assertEqual("clarificationMeaningBoundary.responseKind", clarificationMeaningBoundary.responsePlan.responseKind, "clarification");
assertEqual("clarificationMeaningBoundary.responsePlan.shouldCallAI", clarificationMeaningBoundary.responsePlan.shouldCallAI, true);

const emptyRequestBoundary = createLivingSGBoundary({
  text: "",
  transport: "telegram",
  chatIdStr: "123",
  globalUserId: "gary",
  senderId: "gary-telegram",
  isPrivateChat: true,
  isMonarchUser: true,
  userRole: "monarch",
  coreMeaning: {},
});

assertBoundarySafety("emptyRequestBoundary", emptyRequestBoundary);
assertEqual("emptyRequestBoundary.ok", emptyRequestBoundary.ok, false);
assertEqual("emptyRequestBoundary.intentKind", emptyRequestBoundary.intentPlan.intentKind, "unknown");
assertEqual("emptyRequestBoundary.actionType", emptyRequestBoundary.capabilityPlan.actionType, "blocked");
assertEqual("emptyRequestBoundary.gate", emptyRequestBoundary.gate.status, "blocked");
assertEqual("emptyRequestBoundary.responseKind", emptyRequestBoundary.responsePlan.responseKind, "blocked");
assertEqual("emptyRequestBoundary.responsePlan.shouldCallAI", emptyRequestBoundary.responsePlan.shouldCallAI, false);

console.log("OK: Living SG meaning/logic contract follows meaning -> intent -> capability -> gate -> response without execution.");
