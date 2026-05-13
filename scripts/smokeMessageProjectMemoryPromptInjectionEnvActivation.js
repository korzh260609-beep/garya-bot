import assert from "node:assert/strict";
import {
  MESSAGE_CONTEXT_INJECTION_MODES,
  MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_MODES,
  getMessageProjectMemoryContextGateOptionsFromEnv,
  prepareMessageContextInjection,
  prepareMessageProjectMemoryContextGate,
} from "../src/core/message/index.js";

function createRuntimeContextMock({ facts = [] } = {}) {
  const calls = [];
  return {
    calls,
    async buildConfirmedProjectMemoryContextItems(input = {}) {
      calls.push(input);
      return {
        ok: true,
        facts,
        items: facts.map((fact) => ({
          type: "project_memory",
          content: fact.content || "",
          source: fact.source || "mock:confirmed_project_memory",
          priority: "below_verified_sources",
          trust: fact.metadata?.trust || "confirmed",
          scope: fact.metadata?.scope || "global_project",
          owner: "sg_project",
          metadata: fact.metadata || {},
        })),
        warnings: [],
        limits: input.limits || {},
        guard: { ok: true, skipped: true, reason: "not_user_project_memory" },
      };
    },
  };
}

const ENV_KEYS = [
  "SG_PROJECT_MEMORY_CONTEXT_ENABLED",
  "SG_PROJECT_MEMORY_PROMPT_INJECTION_ENABLED",
  "SG_PROJECT_MEMORY_CONTEXT_MAX_ENTRIES",
  "SG_PROJECT_MEMORY_CONTEXT_PACK_MAX_ITEMS",
  "SG_PROJECT_MEMORY_CONTEXT_PACK_MAX_CHARS",
];

const OLD_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const [key, value] of Object.entries(OLD_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

try {
  for (const key of ENV_KEYS) delete process.env[key];

  process.env.SG_PROJECT_MEMORY_CONTEXT_ENABLED = "true";
  process.env.SG_PROJECT_MEMORY_PROMPT_INJECTION_ENABLED = "true";
  process.env.SG_PROJECT_MEMORY_CONTEXT_MAX_ENTRIES = "1";
  process.env.SG_PROJECT_MEMORY_CONTEXT_PACK_MAX_ITEMS = "12";
  process.env.SG_PROJECT_MEMORY_CONTEXT_PACK_MAX_CHARS = "1200";

  const options = getMessageProjectMemoryContextGateOptionsFromEnv();
  assert.equal(options.enabled, true);
  assert.equal(options.injectIntoPrompt, true);
  assert.equal(options.projectKey, "sg");
  assert.equal(options.limits.maxEntries, 1);

  const runtimeContext = createRuntimeContextMock({
    facts: [{
      content: "Confirmed Project Memory context is added only after controlled env activation.",
      source: "mock:confirmed_project_memory",
      metadata: { scope: "global_project", trust: "confirmed" },
    }],
  });

  const gate = await prepareMessageProjectMemoryContextGate({
    identity: {
      globalUserId: "global:monarch",
      platform: "smoke",
      platformUserId: "260609",
      role: "monarch",
      displayName: "GARY",
      isMonarch: true,
    },
    text: "Smoke controlled Project Memory context activation",
    behaviorRuntime: { mode: "smoke" },
    options,
    runtimeContext,
  });

  assert.equal(gate.ok, true);
  assert.equal(gate.mode, MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_MODES.READ_AND_INJECT);
  assert.equal(gate.readAttempted, true);
  assert.equal(gate.readOk, true);
  assert.equal(gate.projectKey, "sg");
  assert.equal(gate.projectMemoryFactsCount, 1);
  assert.equal(gate.contextInjectionOptions.enabled, true);
  assert.equal(gate.contextInjectionOptions.mode, MESSAGE_CONTEXT_INJECTION_MODES.INJECT_SYSTEM_CONTEXT);
  assert.equal(gate.readBridge.promptInjectionEnabled, false);
  assert.equal(runtimeContext.calls.length, 1);
  assert.equal(runtimeContext.calls[0].projectKey, "sg");

  const result = prepareMessageContextInjection({
    messages: [
      { role: "system", content: "base" },
      { role: "user", content: "hello" },
    ],
    contextPack: gate.contextPack,
    options: gate.contextInjectionOptions,
  });

  assert.equal(result.ok, true);
  assert.equal(result.injected, true);
  assert.equal(result.mode, MESSAGE_CONTEXT_INJECTION_MODES.INJECT_SYSTEM_CONTEXT);
  assert.equal(result.messages.length, 3);
  assert.equal(result.messages[2].role, "system");
  assert.equal(result.messages[2].content.includes("SG_CONTEXT_PACK_BEGIN"), true);
  assert.equal(result.messages[2].content.includes("type=project_memory"), true);

  console.log("smokeMessageProjectMemoryPromptInjectionEnvActivation: ok");
} finally {
  restoreEnv();
}
