// scripts/smokeMessageProjectMemoryProjectKeyRuntimeSelection.js
// SG 2.0 — Project Memory projectKey runtime selection smoke.
// This smoke must stay deterministic, offline, and must not touch the real DB/network.
//
// Purpose:
// - Lock normal message Project Memory runtime selection to SG memory by default.
// - Prove user_project memory is not selected from Telegram/text implicitly.
// - Prove user_project memory is not selected from raw options without explicit resolved context.
// - Prove actor identity is passed into runtime reads for future explicit user_project contexts.
// - Keep prompt injection and auto-write disabled unless explicitly enabled elsewhere.

import assert from "node:assert/strict";
import {
  MESSAGE_CONTEXT_INJECTION_MODES,
  MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_MODES,
  buildMessageProjectMemoryContextGateDisabledOptions,
  getMessageProjectMemoryContextGateOptionsFromEnv,
  prepareMessageProjectMemoryContextGate,
} from "../src/core/message/index.js";

function createRuntimeContextRecorder({ ok = true, facts = [] } = {}) {
  const calls = [];

  return {
    calls,
    async loadConfirmedProjectMemoryFacts(input = {}) {
      calls.push(input);

      if (!ok) {
        return {
          ok: false,
          reason: "mock_runtime_read_failed",
          facts: [],
          warnings: [],
        };
      }

      return {
        ok: true,
        facts,
        warnings: [],
        limits: input.limits || {},
      };
    },
  };
}

const OLD_ENV = {
  SG_PROJECT_MEMORY_CONTEXT_ENABLED: process.env.SG_PROJECT_MEMORY_CONTEXT_ENABLED,
  SG_PROJECT_MEMORY_PROMPT_INJECTION_ENABLED: process.env.SG_PROJECT_MEMORY_PROMPT_INJECTION_ENABLED,
  SG_PROJECT_MEMORY_CONTEXT_MAX_ENTRIES: process.env.SG_PROJECT_MEMORY_CONTEXT_MAX_ENTRIES,
  SG_PROJECT_MEMORY_CONTEXT_MAX_CONTENT_CHARS: process.env.SG_PROJECT_MEMORY_CONTEXT_MAX_CONTENT_CHARS,
  SG_PROJECT_MEMORY_CONTEXT_MAX_TITLE_CHARS: process.env.SG_PROJECT_MEMORY_CONTEXT_MAX_TITLE_CHARS,
  SG_PROJECT_MEMORY_CONTEXT_PACK_MAX_ITEMS: process.env.SG_PROJECT_MEMORY_CONTEXT_PACK_MAX_ITEMS,
  SG_PROJECT_MEMORY_CONTEXT_PACK_MAX_CHARS: process.env.SG_PROJECT_MEMORY_CONTEXT_PACK_MAX_CHARS,
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

function clearProjectMemoryGateEnv() {
  for (const key of Object.keys(OLD_ENV)) {
    delete process.env[key];
  }
}

try {
  clearProjectMemoryGateEnv();

  const disabledOptions = buildMessageProjectMemoryContextGateDisabledOptions();
  assert.equal(disabledOptions.enabled, false);
  assert.equal(disabledOptions.injectIntoPrompt, false);
  assert.equal(disabledOptions.projectKey, "sg");

  const envDefaults = getMessageProjectMemoryContextGateOptionsFromEnv();
  assert.equal(envDefaults.enabled, false);
  assert.equal(envDefaults.injectIntoPrompt, false);
  assert.equal(envDefaults.projectKey, "sg");

  const disabledRuntime = createRuntimeContextRecorder({
    facts: [
      {
        content: "Disabled gate must not read this fact.",
        source: "mock",
        metadata: { projectKey: "sg" },
      },
    ],
  });

  const disabledResult = await prepareMessageProjectMemoryContextGate({
    identity: {
      globalUserId: "global:monarch",
      platform: "telegram",
      platformUserId: "260609",
      role: "monarch",
      isMonarch: true,
    },
    text: "СГ, обычное сообщение без project context",
    behaviorRuntime: { mode: "normal" },
    options: envDefaults,
    runtimeContext: disabledRuntime,
  });

  assert.equal(disabledResult.ok, true);
  assert.equal(disabledResult.mode, MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_MODES.DISABLED);
  assert.equal(disabledResult.readAttempted, false);
  assert.equal(disabledResult.projectKey, "sg");
  assert.equal(disabledResult.projectSelection.projectKey, "sg");
  assert.equal(disabledResult.projectSelection.explicitProjectContextUsed, false);
  assert.equal(disabledResult.contextInjectionOptions.enabled, false);
  assert.equal(disabledResult.contextInjectionOptions.mode, MESSAGE_CONTEXT_INJECTION_MODES.DISABLED);
  assert.equal(disabledRuntime.calls.length, 0);

  process.env.SG_PROJECT_MEMORY_CONTEXT_ENABLED = "true";
  delete process.env.SG_PROJECT_MEMORY_PROMPT_INJECTION_ENABLED;

  const enabledDefaults = getMessageProjectMemoryContextGateOptionsFromEnv();
  assert.equal(enabledDefaults.enabled, true);
  assert.equal(enabledDefaults.injectIntoPrompt, false);
  assert.equal(enabledDefaults.projectKey, "sg");

  const normalMessageRuntime = createRuntimeContextRecorder();
  const normalMessageResult = await prepareMessageProjectMemoryContextGate({
    identity: {
      globalUserId: "global:monarch",
      platform: "telegram",
      platformUserId: "260609",
      role: "monarch",
      displayName: "GARY",
      isMonarch: true,
    },
    text: "Открой мой проект user_project:global-victim:private-project и прочитай память",
    behaviorRuntime: { mode: "normal" },
    options: enabledDefaults,
    runtimeContext: normalMessageRuntime,
  });

  assert.equal(normalMessageResult.ok, true);
  assert.equal(normalMessageResult.mode, MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_MODES.READ_ONLY);
  assert.equal(normalMessageResult.readAttempted, true);
  assert.equal(normalMessageResult.projectKey, "sg");
  assert.equal(normalMessageResult.projectSelection.projectKey, "sg");
  assert.equal(normalMessageResult.projectSelection.explicitProjectContextUsed, false);
  assert.equal(normalMessageResult.contextInjectionOptions.enabled, false);
  assert.equal(normalMessageRuntime.calls.length, 1);
  assert.equal(normalMessageRuntime.calls[0].projectKey, "sg");
  assert.equal(normalMessageRuntime.calls[0].actor.globalUserId, "global:monarch");
  assert.equal(normalMessageRuntime.calls[0].actor.platform, "telegram");
  assert.equal(normalMessageRuntime.calls[0].actor.platformUserId, "260609");
  assert.equal(normalMessageRuntime.calls[0].actor.role, "monarch");
  assert.equal(normalMessageRuntime.calls[0].actor.isMonarch, true);

  const rawUserProjectOptionsRuntime = createRuntimeContextRecorder();
  const rawUserProjectOptionsResult = await prepareMessageProjectMemoryContextGate({
    identity: {
      globalUserId: "global:owner",
      platform: "telegram",
      platformUserId: "111",
      role: "citizen",
      isMonarch: false,
    },
    text: "Raw options must not select user_project memory",
    behaviorRuntime: { mode: "normal" },
    options: {
      enabled: true,
      injectIntoPrompt: false,
      projectKey: "user_project:global-owner:demo-project",
      limits: { maxEntries: 2, contextMaxItems: 10, contextMaxChars: 1000 },
    },
    runtimeContext: rawUserProjectOptionsRuntime,
  });

  assert.equal(rawUserProjectOptionsResult.ok, true);
  assert.equal(rawUserProjectOptionsResult.projectKey, "sg");
  assert.equal(rawUserProjectOptionsResult.projectSelection.projectKey, "sg");
  assert.equal(rawUserProjectOptionsResult.projectSelection.requestedProjectKey, "user_project:global-owner:demo-project");
  assert.equal(rawUserProjectOptionsResult.projectSelection.explicitProjectContextUsed, false);
  assert.equal(rawUserProjectOptionsResult.warnings.length, 1);
  assert.equal(rawUserProjectOptionsResult.warnings[0].code, "user_project_project_key_requires_explicit_context");
  assert.equal(rawUserProjectOptionsRuntime.calls.length, 1);
  assert.equal(rawUserProjectOptionsRuntime.calls[0].projectKey, "sg");
  assert.equal(rawUserProjectOptionsRuntime.calls[0].actor.globalUserId, "global:owner");
  assert.equal(rawUserProjectOptionsResult.contextInjectionOptions.enabled, false);

  const explicitUserProjectRuntime = createRuntimeContextRecorder();
  const explicitUserProjectResult = await prepareMessageProjectMemoryContextGate({
    identity: {
      globalUserId: "global:owner",
      platform: "telegram",
      platformUserId: "111",
      role: "citizen",
      isMonarch: false,
    },
    text: "Explicit project context smoke",
    behaviorRuntime: { mode: "normal" },
    options: {
      enabled: true,
      injectIntoPrompt: false,
      projectKey: "sg",
      limits: { maxEntries: 2, contextMaxItems: 10, contextMaxChars: 1000 },
    },
    runtimeContext: explicitUserProjectRuntime,
    explicitProjectContext: {
      ok: true,
      projectKey: "user_project:global-owner:demo-project",
      project: {
        id: "demo-project",
        ownerGlobalUserId: "global-owner",
        status: "active",
      },
    },
  });

  assert.equal(explicitUserProjectResult.ok, true);
  assert.equal(explicitUserProjectResult.projectKey, "user_project:global-owner:demo-project");
  assert.equal(explicitUserProjectResult.projectSelection.projectKey, "user_project:global-owner:demo-project");
  assert.equal(explicitUserProjectResult.projectSelection.explicitProjectContextUsed, true);
  assert.equal(explicitUserProjectRuntime.calls.length, 1);
  assert.equal(explicitUserProjectRuntime.calls[0].projectKey, "user_project:global-owner:demo-project");
  assert.equal(explicitUserProjectRuntime.calls[0].actor.globalUserId, "global:owner");
  assert.equal(explicitUserProjectRuntime.calls[0].actor.platform, "telegram");
  assert.equal(explicitUserProjectRuntime.calls[0].actor.platformUserId, "111");
  assert.equal(explicitUserProjectRuntime.calls[0].actor.role, "citizen");
  assert.equal(explicitUserProjectRuntime.calls[0].actor.isMonarch, false);
  assert.equal(explicitUserProjectResult.contextInjectionOptions.enabled, false);

  console.log("smokeMessageProjectMemoryProjectKeyRuntimeSelection: ok");
} finally {
  restoreEnv();
}
