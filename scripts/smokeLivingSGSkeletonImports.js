// scripts/smokeLivingSGSkeletonImports.js
// ============================================================================
// LIVING SG SKELETON IMPORT SMOKE CHECK
//
// Purpose:
// - verify Living SG skeleton modules can be imported;
// - verify the read-only skeleton contract;
// - does not connect Living SG to runtime;
// - does not call external services;
// - does not execute commands, diagnostics or projectIntent bridges.
// ============================================================================

import { createLivingSGBoundary } from "../src/core/living-sg/LivingSGBoundary.js";
import { createLivingRequest } from "../src/core/living-sg/LivingRequest.js";
import {
  createLivingIntentPlan,
  LIVING_INTENT_KIND,
} from "../src/core/living-sg/LivingIntentPlan.js";
import {
  createLivingCapabilityPlan,
  LIVING_ACTION_TYPE,
  LIVING_CAPABILITY,
} from "../src/core/living-sg/LivingCapabilityPlan.js";
import {
  evaluateLivingActionGate,
  LIVING_GATE_STATUS,
} from "../src/core/living-sg/LivingActionGate.js";
import {
  createLivingResponsePlan,
  LIVING_RESPONSE_KIND,
} from "../src/core/living-sg/LivingResponsePlan.js";

function assertFunction(name, value) {
  if (typeof value !== "function") {
    throw new Error(`Living SG skeleton smoke check failed: ${name} is not a function`);
  }
}

function assertEqual(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`Living SG skeleton smoke check failed: ${name}: expected ${expected}, got ${actual}`);
  }
}

assertFunction("createLivingSGBoundary", createLivingSGBoundary);
assertFunction("createLivingRequest", createLivingRequest);
assertFunction("createLivingIntentPlan", createLivingIntentPlan);
assertFunction("createLivingCapabilityPlan", createLivingCapabilityPlan);
assertFunction("evaluateLivingActionGate", evaluateLivingActionGate);
assertFunction("createLivingResponsePlan", createLivingResponsePlan);

const request = createLivingRequest({
  text: "проверь архитектуру проекта",
  transport: "telegram",
  chatId: "123",
  globalUserId: "gary",
  isPrivateChat: true,
  isMonarchUser: true,
  userRole: "monarch",
});

assertEqual("request.ok", request.ok, true);
assertEqual("request.dryRun", request.dryRun, true);
assertEqual("request.metadata.noRuntimeExecution", request.metadata.noRuntimeExecution, true);

const projectIntentPlan = createLivingIntentPlan({
  request,
  meaning: {
    domain: "project",
    intent: "project_message",
    suggestedAction: "answer",
  },
});

assertEqual("projectIntentPlan.intentKind", projectIntentPlan.intentKind, LIVING_INTENT_KIND.PROJECT_THINKING);

const projectCapabilityPlan = createLivingCapabilityPlan({ intentPlan: projectIntentPlan });

assertEqual("projectCapabilityPlan.actionType", projectCapabilityPlan.actionType, LIVING_ACTION_TYPE.READ_ONLY);
assertEqual(
  "projectCapabilityPlan has analyze",
  projectCapabilityPlan.capabilities.includes(LIVING_CAPABILITY.ANALYZE),
  true
);

const projectGate = evaluateLivingActionGate({ capabilityPlan: projectCapabilityPlan });

assertEqual("projectGate.status", projectGate.status, LIVING_GATE_STATUS.ALLOW_READ_ONLY);
assertEqual("projectGate.canChangeState", projectGate.canChangeState, false);

const projectResponsePlan = createLivingResponsePlan({
  request,
  intentPlan: projectIntentPlan,
  capabilityPlan: projectCapabilityPlan,
  gate: projectGate,
});

assertEqual("projectResponsePlan.responseKind", projectResponsePlan.responseKind, LIVING_RESPONSE_KIND.ANSWER);
assertEqual("projectResponsePlan.shouldExecuteTool", projectResponsePlan.shouldExecuteTool, false);

const memoryIntentPlan = createLivingIntentPlan({
  request,
  meaning: {
    domain: "memory",
    intent: "save_memory",
    suggestedAction: "answer",
  },
});

assertEqual("memoryIntentPlan.intentKind", memoryIntentPlan.intentKind, LIVING_INTENT_KIND.MEMORY_THINKING);

const memoryCapabilityPlan = createLivingCapabilityPlan({ intentPlan: memoryIntentPlan });

assertEqual("memoryCapabilityPlan.actionType", memoryCapabilityPlan.actionType, LIVING_ACTION_TYPE.NEEDS_CONFIRMATION);
assertEqual("memoryCapabilityPlan.requiresConfirmation", memoryCapabilityPlan.requiresConfirmation, true);

const memoryGate = evaluateLivingActionGate({ capabilityPlan: memoryCapabilityPlan });

assertEqual("memoryGate.status", memoryGate.status, LIVING_GATE_STATUS.NEEDS_CONFIRMATION);
assertEqual("memoryGate.canChangeState", memoryGate.canChangeState, false);

const memoryResponsePlan = createLivingResponsePlan({
  request,
  intentPlan: memoryIntentPlan,
  capabilityPlan: memoryCapabilityPlan,
  gate: memoryGate,
});

assertEqual("memoryResponsePlan.responseKind", memoryResponsePlan.responseKind, LIVING_RESPONSE_KIND.CONFIRMATION_REQUEST);
assertEqual("memoryResponsePlan.shouldCallAI", memoryResponsePlan.shouldCallAI, false);

const boundary = createLivingSGBoundary({
  text: "проверь архитектуру проекта",
  transport: "telegram",
  chatId: "123",
  globalUserId: "gary",
  isPrivateChat: true,
  isMonarchUser: true,
  userRole: "monarch",
  coreMeaning: {
    domain: "project",
    intent: "project_message",
    suggestedAction: "answer",
  },
});

assertEqual("boundary.connectedToRuntime", boundary.connectedToRuntime, false);
assertEqual("boundary.metadata.noSlashCommandsAdded", boundary.metadata.noSlashCommandsAdded, true);
assertEqual("boundary.metadata.noTechnicalModeExpansion", boundary.metadata.noTechnicalModeExpansion, true);
assertEqual("boundary.metadata.noDiagnosticBridge", boundary.metadata.noDiagnosticBridge, true);
assertEqual("boundary.metadata.noProjectIntentExecution", boundary.metadata.noProjectIntentExecution, true);
assertEqual("boundary.metadata.noStateChange", boundary.metadata.noStateChange, true);
assertEqual("boundary.responsePlan.shouldExecuteTool", boundary.responsePlan.shouldExecuteTool, false);

console.log("OK: Living SG skeleton imports and read-only skeleton contract are valid.");
