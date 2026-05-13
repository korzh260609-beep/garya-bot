// scripts/smokeMessageProjectMemoryContextGate.js
// SG 2.0 — Message Project Memory Context Gate smoke.
// This smoke must stay deterministic, offline, and must not touch the real DB/network.

import assert from "node:assert/strict";
import {
  MESSAGE_CONTEXT_INJECTION_MODES,
  prepareMessageContextInjection,
  MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_MODES,
  getMessageProjectMemoryContextGateOptionsFromEnv,
  prepareMessageProjectMemoryContextGate,
} from "../src/core/message/index.js";

function factToItem(fact = {}) {
  return {
    type: "project_memory",
    content: fact.content || "",
    source: fact.source || "mock:confirmed_project_memory",
    priority: "below_verified_sources",
    trust: fact.metadata?.trust || "confirmed",
    scope: fact.metadata?.scope || "global_project",
    owner: "sg_project",
    metadata: fact.metadata || {},
  };
}

function createRuntimeContextMock({ ok = true, facts = [] } = {}) {
  const calls = [];

  return {
    calls,
    async buildConfirmedProjectMemoryContextItems(input) {
      calls.push(input);
      if (!ok) {
        return {
          ok: false,
          reason: "mock_project_memory_read_failed",
          facts: [],
          items: [],
          warnings: [{ code: "mock_read_failed", message: "Mock read failed." }],
        };
      }

      return {
        ok: true,
        facts,
        items: facts.map(factToItem),
        warnings: [],
        limits: input?.limits || {},
        guard: { ok: true, skipped: true, reason: "not_user_project_memory" },
      };
    },
  };
}

const OLD_ENV = {
  SG_PROJECT_MEMORY_CONTEXT_ENABLED: process.env.SG_PROJECT_MEMORY_CONTEXT_ENABLED,
  SG_PROJECT_MEMORY_PROMPT_INJECTION_ENABLED: process.env.SG_PROJECT_MEMORY_PROMPT_INJECTION_ENABLED,
  SG_PROJECT_MEMORY_CONTEXT_MAX_ENTRIES: process.env.SG_PROJECT_MEMORY_CONTEXT_MAX_ENTRIES,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(OLD_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

try {
  delete process.env.SG_PROJECT_MEMORY_CONTEXT_ENABLED;
  delete process.env.SG_PROJECT_MEMORY_PROMPT_INJECTION_ENABLED;
  delete process.env.SG_PROJECT_MEMORY_CONTEXT_MAX_ENTRIES;

  const defaultOptions = getMessageProjectMemoryContextGateOptionsFromEnv();
  assert.equal(defaultOptions.enabled, false);
  assert.equal(defaultOptions.injectIntoPrompt, false);
  assert.equal(defaultOptions.projectKey, "sg");
  assert.equal(defaultOptions.limits.maxEntries, 5);

  const disabledRuntime = createRuntimeContextMock({
    facts: [
      {
        content: "This fact must not be read when gate is disabled.",
        source: "mock",
        metadata: { scope: "global_project" },
      },
    ],
  });

  const disabled = await prepareMessageProjectMemoryContextGate({
    identity: { globalUserId: "global:test", platform: "smoke", role: "monarch", isMonarch: true },
    text: "Test disabled gate",
    behaviorRuntime: { mode: "smoke" },
    options: defaultOptions,
    runtimeContext: disabledRuntime,
  });

  assert.equal(disabled.ok, true);
  assert.equal(disabled.mode, MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_MODES.DISABLED);
  assert.equal(disabled.readAttempted, false);
  assert.equal(disabled.projectMemoryFactsCount, 0);
  assert.equal(disabled.contextInjectionOptions.enabled, false);
  assert.equal(disabled.contextInjectionOptions.mode, MESSAGE_CONTEXT_INJECTION_MODES.DISABLED);
  assert.equal(disabledRuntime.calls.length, 0);
  assert.equal(disabled.contextPack.items.some((item) => item.type === "project_memory"), false);

  const readOnlyRuntime = createRuntimeContextMock({
    facts: [
      {
        content: "Confirmed Project Memory can be included in context pack when read gate is enabled.",
        source: "mock:confirmed_project_memory",
        metadata: { scope: "global_project", trust: "confirmed" },
      },
    ],
  });

  const readOnly = await prepareMessageProjectMemoryContextGate({
    identity: { globalUserId: "global:test", platform: "smoke", role: "monarch", isMonarch: true },
    text: "Test read-only gate",
    behaviorRuntime: { mode: "smoke" },
    options: {
      enabled: true,
      injectIntoPrompt: false,
      projectKey: "sg",
      limits: { maxEntries: 1, contextMaxItems: 12, contextMaxChars: 1200 },
    },
    runtimeContext: readOnlyRuntime,
  });

  assert.equal(readOnly.ok, true);
  assert.equal(readOnly.mode, MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_MODES.READ_ONLY);
  assert.equal(readOnly.readAttempted, true);
  assert.equal(readOnly.readOk, true);
  assert.equal(readOnly.projectMemoryFactsCount, 1);
  assert.equal(readOnly.contextInjectionOptions.enabled, false);
  assert.equal(readOnly.contextInjectionOptions.mode, MESSAGE_CONTEXT_INJECTION_MODES.DISABLED);
  assert.equal(readOnlyRuntime.calls.length, 1);
  assert.equal(readOnlyRuntime.calls[0].projectKey, "sg");
  assert.equal(readOnlyRuntime.calls[0].limits.maxEntries, 1);
  assert.equal(readOnly.readBridge.promptInjectionEnabled, false);
  assert.equal(readOnly.contextPack.items.some((item) => item.type === "project_memory"), true);

  const readOnlyInjection = prepareMessageContextInjection({
    messages: [{ role: "system", content: "base" }, { role: "user", content: "hello" }],
    contextPack: readOnly.contextPack,
    options: readOnly.contextInjectionOptions,
  });
  assert.equal(readOnlyInjection.ok, true);
  assert.equal(readOnlyInjection.injected, false);
  assert.equal(readOnlyInjection.messages.length, 2);

  const injectRuntime = createRuntimeContextMock({
    facts: [
      {
        content: "Confirmed Project Memory is injected only when prompt injection flag is explicitly enabled.",
        source: "mock:confirmed_project_memory",
        metadata: { scope: "global_project", trust: "confirmed" },
      },
    ],
  });

  const readAndInject = await prepareMessageProjectMemoryContextGate({
    identity: { globalUserId: "global:test", platform: "smoke", role: "monarch", isMonarch: true },
    text: "Test read and inject gate",
    behaviorRuntime: { mode: "smoke" },
    options: {
      enabled: true,
      injectIntoPrompt: true,
      projectKey: "sg",
      limits: { maxEntries: 1, contextMaxItems: 12, contextMaxChars: 1200 },
    },
    runtimeContext: injectRuntime,
  });

  assert.equal(readAndInject.ok, true);
  assert.equal(readAndInject.mode, MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_MODES.READ_AND_INJECT);
  assert.equal(readAndInject.readAttempted, true);
  assert.equal(readAndInject.readOk, true);
  assert.equal(readAndInject.projectMemoryFactsCount, 1);
  assert.equal(readAndInject.contextInjectionOptions.enabled, true);
  assert.equal(readAndInject.contextInjectionOptions.mode, MESSAGE_CONTEXT_INJECTION_MODES.INJECT_SYSTEM_CONTEXT);
  assert.equal(readAndInject.readBridge.promptInjectionEnabled, false);

  const injected = prepareMessageContextInjection({
    messages: [{ role: "system", content: "base" }, { role: "user", content: "hello" }],
    contextPack: readAndInject.contextPack,
    options: readAndInject.contextInjectionOptions,
  });
  assert.equal(injected.ok, true);
  assert.equal(injected.injected, true);
  assert.equal(injected.messages.length, 3);
  assert.equal(injected.messages[2].role, "system");
  assert.equal(injected.messages[2].content.includes("SG_CONTEXT_PACK_BEGIN"), true);
  assert.equal(injected.messages[2].content.includes("type=project_memory"), true);

  const failRuntime = createRuntimeContextMock({ ok: false });
  const failed = await prepareMessageProjectMemoryContextGate({
    identity: { globalUserId: "global:test" },
    text: "Test failed read",
    options: {
      enabled: true,
      injectIntoPrompt: true,
      projectKey: "sg",
      limits: { maxEntries: 1 },
    },
    runtimeContext: failRuntime,
  });

  assert.equal(failed.ok, false);
  assert.equal(failed.readAttempted, true);
  assert.equal(failed.readOk, false);
  assert.equal(failed.contextInjectionOptions.enabled, false);
  assert.equal(failed.readBridge.promptInjectionEnabled, false);
  assert.equal(failed.contextPack.items.some((item) => item.type === "project_memory"), false);

  console.log("smokeMessageProjectMemoryContextGate: ok");
} finally {
  restoreEnv();
}
