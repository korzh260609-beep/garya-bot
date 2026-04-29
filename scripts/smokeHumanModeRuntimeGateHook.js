// scripts/smokeHumanModeRuntimeGateHook.js
// ============================================================================
// HUMAN MODE RUNTIME GATE HOOK SMOKE CHECK
//
// Purpose:
// - verify the disabled-by-default Human Mode project/repo runtime gate contract.
// - verify handleMessage can be imported after adding the gated dry-run hook.
// - verify gate OFF does not produce Human Mode dry-run output in shadow mode.
// - verify gate ON only produces dry-run metadata and still does not send replies.
// ============================================================================

const previousGateValue = process.env.HUMAN_MODE_PROJECT_REPO_ENABLED;

try {
  const { isHumanModeProjectRepoRuntimeEnabled } = await import(
    "../src/core/projectIntent/modes/human/projectIntentHumanRuntimeGateConfig.js"
  );
  const { handleMessage } = await import("../src/core/handleMessage.js");

  if (isHumanModeProjectRepoRuntimeEnabled({}) !== false) {
    throw new Error("Human Mode runtime gate smoke failed: empty env must be disabled");
  }

  if (isHumanModeProjectRepoRuntimeEnabled({ HUMAN_MODE_PROJECT_REPO_ENABLED: "true" }) !== true) {
    throw new Error("Human Mode runtime gate smoke failed: true env must enable gate");
  }

  process.env.HUMAN_MODE_PROJECT_REPO_ENABLED = "false";

  const gateOffResult = await handleMessage({
    transport: "smoke",
    chatId: "1",
    senderId: "1",
    text: "проверь архитектуру проекта",
    messageId: "smoke-gate-off",
    isEnforced: false,
    raw: {},
  });

  if (gateOffResult?.ok !== true || gateOffResult?.stage !== "6.shadow") {
    throw new Error("Human Mode runtime gate smoke failed: gate OFF shadow result mismatch");
  }

  if (gateOffResult?.humanModeProjectRepoDryRun !== null) {
    throw new Error("Human Mode runtime gate smoke failed: gate OFF must not produce dry-run metadata");
  }

  process.env.HUMAN_MODE_PROJECT_REPO_ENABLED = "true";

  const gateOnResult = await handleMessage({
    transport: "smoke",
    chatId: "1",
    senderId: "1",
    text: "проверь архитектуру проекта",
    messageId: "smoke-gate-on",
    isEnforced: false,
    raw: {},
  });

  if (gateOnResult?.ok !== true || gateOnResult?.stage !== "6.shadow") {
    throw new Error("Human Mode runtime gate smoke failed: gate ON shadow result mismatch");
  }

  if (gateOnResult?.humanModeProjectRepoDryRun?.enabled !== true) {
    throw new Error("Human Mode runtime gate smoke failed: gate ON must produce dry-run metadata");
  }

  if (gateOnResult?.humanModeProjectRepoDryRun?.handled === true) {
    throw new Error("Human Mode runtime gate smoke failed: dry-run must not handle without repo facts");
  }

  console.log("OK: Human Mode runtime gate hook contract is valid.");
} finally {
  if (previousGateValue === undefined) {
    delete process.env.HUMAN_MODE_PROJECT_REPO_ENABLED;
  } else {
    process.env.HUMAN_MODE_PROJECT_REPO_ENABLED = previousGateValue;
  }
}
