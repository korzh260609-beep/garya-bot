// scripts/smokeLivingSGBoundarySafetyContract.js
// ============================================================================
// LIVING SG BOUNDARY SAFETY CONTRACT SMOKE CHECK
//
// Purpose:
// - verify Living SG boundary remains read-only/dry-run for different meanings;
// - verify Living SG boundary never executes tools;
// - verify Living SG boundary never changes state;
// - verify Living SG boundary stays disconnected from runtime;
// - verify confirmations do not turn the skeleton into an executor;
// - does not call AI;
// - does not read/write repo/runtime state.
// ============================================================================

import { createLivingSGBoundary } from "../src/core/living-sg/LivingSGBoundary.js";

function assertEqual(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`Living SG boundary safety contract failed: ${name}: expected ${expected}, got ${actual}`);
  }
}

function assertArrayIncludes(name, value, expectedPart) {
  if (!Array.isArray(value) || !value.includes(expectedPart)) {
    throw new Error(`Living SG boundary safety contract failed: ${name}: missing ${expectedPart}`);
  }
}

function assertUniversalBoundarySafety(name, boundary) {
  assertEqual(`${name}.dryRun`, boundary?.dryRun, true);
  assertEqual(`${name}.connectedToRuntime`, boundary?.connectedToRuntime, false);
  assertEqual(`${name}.metadata.noSlashCommandsAdded`, boundary?.metadata?.noSlashCommandsAdded, true);
  assertEqual(`${name}.metadata.noTechnicalModeExpansion`, boundary?.metadata?.noTechnicalModeExpansion, true);
  assertEqual(`${name}.metadata.noDiagnosticBridge`, boundary?.metadata?.noDiagnosticBridge, true);
  assertEqual(`${name}.metadata.noProjectIntentExecution`, boundary?.metadata?.noProjectIntentExecution, true);
  assertEqual(`${name}.metadata.noStateChange`, boundary?.metadata?.noStateChange, true);
  assertEqual(`${name}.responsePlan.shouldExecuteTool`, boundary?.responsePlan?.shouldExecuteTool, false);
  assertEqual(`${name}.gate.canChangeState`, boundary?.gate?.canChangeState, false);
}

function createBaseInput(overrides = {}) {
  return {
    text: "test request",
    transport: "telegram",
    chatIdStr: "123",
    globalUserId: "gary",
    senderId: "gary-telegram",
    isPrivateChat: true,
    isMonarchUser: true,
    userRole: "monarch",
    ...overrides,
  };
}

const cases = [
  {
    name: "generalMeaning",
    input: createBaseInput({
      text: "объясни идею простыми словами",
      coreMeaning: {
        domain: "general",
        intent: "general_question",
        suggestedAction: "answer",
        confidence: "high",
      },
    }),
    expected: {
      ok: true,
      intentKind: "general_response",
      actionType: "read_only",
      gateStatus: "allow_read_only",
      responseKind: "answer",
      shouldCallAI: true,
      capabilities: ["think"],
    },
  },
  {
    name: "projectMeaning",
    input: createBaseInput({
      text: "проанализируй следующий шаг проекта",
      coreMeaning: {
        domain: "project",
        intent: "project_message",
        suggestedAction: "answer",
        confidence: "high",
      },
    }),
    expected: {
      ok: true,
      intentKind: "project_thinking",
      actionType: "read_only",
      gateStatus: "allow_read_only",
      responseKind: "answer",
      shouldCallAI: true,
      capabilities: ["think", "analyze", "prepare_proposal"],
    },
  },
  {
    name: "memoryMeaningWithoutConfirmation",
    input: createBaseInput({
      text: "запомни это как правило",
      coreMeaning: {
        domain: "memory",
        intent: "memory_change_request",
        suggestedAction: "remember",
        confidence: "high",
      },
    }),
    expected: {
      ok: true,
      intentKind: "memory_thinking",
      actionType: "needs_confirmation",
      gateStatus: "needs_confirmation",
      responseKind: "confirmation_request",
      shouldCallAI: false,
      capabilities: ["think", "memory_proposal"],
    },
  },
  {
    name: "memoryMeaningWithConfirmationStillReadOnly",
    input: createBaseInput({
      text: "запомни это как правило",
      confirmation: { approved: true },
      coreMeaning: {
        domain: "memory",
        intent: "memory_change_request",
        suggestedAction: "remember",
        confidence: "high",
      },
    }),
    expected: {
      ok: true,
      intentKind: "memory_thinking",
      actionType: "needs_confirmation",
      gateStatus: "allow_read_only",
      responseKind: "answer",
      shouldCallAI: true,
      capabilities: ["think", "memory_proposal"],
    },
  },
  {
    name: "clarificationMeaning",
    input: createBaseInput({
      text: "проверь это",
      coreMeaning: {
        domain: "unknown",
        intent: "unclear",
        suggestedAction: "clarify",
        confidence: "low",
      },
    }),
    expected: {
      ok: true,
      intentKind: "clarify",
      actionType: "read_only",
      gateStatus: "allow_read_only",
      responseKind: "clarification",
      shouldCallAI: true,
      capabilities: ["clarify"],
    },
  },
  {
    name: "emptyRequest",
    input: createBaseInput({
      text: "",
      coreMeaning: {},
    }),
    expected: {
      ok: false,
      intentKind: "unknown",
      actionType: "blocked",
      gateStatus: "blocked",
      responseKind: "blocked",
      shouldCallAI: false,
      capabilities: ["none"],
    },
  },
];

for (const item of cases) {
  const boundary = createLivingSGBoundary(item.input);

  assertUniversalBoundarySafety(item.name, boundary);
  assertEqual(`${item.name}.ok`, boundary?.ok, item.expected.ok);
  assertEqual(`${item.name}.intentKind`, boundary?.intentPlan?.intentKind, item.expected.intentKind);
  assertEqual(`${item.name}.actionType`, boundary?.capabilityPlan?.actionType, item.expected.actionType);
  assertEqual(`${item.name}.gateStatus`, boundary?.gate?.status, item.expected.gateStatus);
  assertEqual(`${item.name}.responseKind`, boundary?.responsePlan?.responseKind, item.expected.responseKind);
  assertEqual(`${item.name}.shouldCallAI`, boundary?.responsePlan?.shouldCallAI, item.expected.shouldCallAI);

  for (const capability of item.expected.capabilities) {
    assertArrayIncludes(`${item.name}.capabilities`, boundary?.capabilityPlan?.capabilities, capability);
  }
}

console.log("OK: Living SG boundary stays dry-run/read-only/disconnected and never executes tools or changes state.");
