// scripts/smokeLivingSGShadowContract.js
// ============================================================================
// LIVING SG SHADOW CONTRACT SMOKE CHECK
//
// Purpose:
// - verify Living SG shadow planning can build a plan;
// - verify shadow planning does not execute tools;
// - verify shadow planning does not write memory;
// - verify fail-open behavior if the injected boundary factory throws.
// ============================================================================

import { buildLivingSGShadowPlan } from "../src/core/handleMessage/handleChatFlow.js";

function assertFunction(name, value) {
  if (typeof value !== "function") {
    throw new Error(`Living SG shadow contract failed: ${name} is not a function`);
  }
}

function assertEqual(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`Living SG shadow contract failed: ${name}: expected ${expected}, got ${actual}`);
  }
}

assertFunction("buildLivingSGShadowPlan", buildLivingSGShadowPlan);

let factoryCallCount = 0;
let toolCallCount = 0;
let memoryWriteCount = 0;

const shadowPlan = buildLivingSGShadowPlan({
  context: {
    coreMeaning: {
      domain: "project",
      intent: "project_message",
      suggestedAction: "answer",
    },
    activeProjectContext: {
      active: true,
      projectKey: "garya-bot",
    },
  },
  transport: "telegram",
  chatIdStr: "123",
  globalUserId: "gary",
  senderId: "gary-telegram",
  trimmed: "проверь архитектуру",
  userRole: "monarch",
  isMonarchUser: true,
  isPrivateChat: true,
  repoFollowupContext: {
    isActive: true,
  },
  projectContextDecision: {
    depth: "light",
  },
  projectMemoryAutoCaptureMeta: {
    projectMemoryAutoCaptureDryRun: true,
  },
  livingSGBoundaryFactory: (input = {}) => {
    factoryCallCount += 1;

    if (input?.trimmed !== "проверь архитектуру") {
      throw new Error("Unexpected trimmed input");
    }

    toolCallCount += 0;
    memoryWriteCount += 0;

    return {
      ok: true,
      dryRun: true,
      source: "LivingSGBoundary",
      connectedToRuntime: false,
      intentPlan: {
        intentKind: "project_thinking",
      },
      capabilityPlan: {
        actionType: "read_only",
      },
      gate: {
        status: "allow_read_only",
      },
      responsePlan: {
        responseKind: "answer",
        shouldCallAI: true,
        shouldExecuteTool: false,
      },
      metadata: {
        noStateChange: true,
        noProjectIntentExecution: true,
      },
    };
  },
});

assertEqual("factoryCallCount", factoryCallCount, 1);
assertEqual("shadowPlan.ok", shadowPlan.ok, true);
assertEqual("shadowPlan.dryRun", shadowPlan.dryRun, true);
assertEqual("shadowPlan.connectedToRuntime", shadowPlan.connectedToRuntime, false);
assertEqual("shadowPlan.responsePlan.shouldExecuteTool", shadowPlan.responsePlan.shouldExecuteTool, false);
assertEqual("shadowPlan.metadata.noStateChange", shadowPlan.metadata.noStateChange, true);
assertEqual("shadowPlan.metadata.noProjectIntentExecution", shadowPlan.metadata.noProjectIntentExecution, true);
assertEqual("toolCallCount", toolCallCount, 0);
assertEqual("memoryWriteCount", memoryWriteCount, 0);

const failedShadowPlan = buildLivingSGShadowPlan({
  trimmed: "сломайся безопасно",
  livingSGBoundaryFactory: () => {
    throw new Error("intentional shadow failure");
  },
});

assertEqual("failedShadowPlan", failedShadowPlan, null);

console.log("OK: Living SG shadow planning contract is valid.");
