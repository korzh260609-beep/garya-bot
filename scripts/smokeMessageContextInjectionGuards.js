// scripts/smokeMessageContextInjectionGuards.js
// SG 2.0 smoke test for message context injection guard branches.

import assert from "node:assert/strict";

import {
  MESSAGE_CONTEXT_INJECTION_MODES,
  prepareMessageContextInjection,
} from "../src/core/message/messageContextInjection.js";

const baseMessages = [
  { role: "system", content: "Base system" },
  { role: "user", content: "Base user" },
];

const unsupportedModeResult = prepareMessageContextInjection({
  messages: baseMessages,
  contextPack: {
    version: 1,
    items: [
      {
        type: "project_memory",
        content: "Guard item.",
        source: "smoke_test",
        trust: "confirmed_memory",
        scope: "sg_project",
        priority: 5,
      },
    ],
  },
  options: {
    enabled: true,
    mode: "unsupported_mode",
    formatterOptions: {},
  },
});

assert.equal(unsupportedModeResult.ok, false);
assert.equal(unsupportedModeResult.mode, "unsupported_mode");
assert.equal(unsupportedModeResult.injected, false);
assert.deepEqual(unsupportedModeResult.messages, baseMessages);
assert.equal(unsupportedModeResult.warnings.length, 1);
assert.equal(unsupportedModeResult.warnings[0].code, "unsupported_context_injection_mode");

const emptyContextResult = prepareMessageContextInjection({
  messages: baseMessages,
  contextPack: {
    version: 1,
    items: [],
  },
  options: {
    enabled: true,
    mode: MESSAGE_CONTEXT_INJECTION_MODES.INJECT_SYSTEM_CONTEXT,
    formatterOptions: {
      limits: {
        maxTotalChars: 1,
      },
    },
  },
});

assert.equal(emptyContextResult.ok, false);
assert.equal(emptyContextResult.mode, MESSAGE_CONTEXT_INJECTION_MODES.INJECT_SYSTEM_CONTEXT);
assert.equal(emptyContextResult.injected, false);
assert.deepEqual(emptyContextResult.messages, baseMessages);
assert.equal(emptyContextResult.warnings.length, 1);
assert.equal(emptyContextResult.warnings[0].code, "empty_formatted_context");

console.log("OK: message context injection guard branches reject unsafe injection states");
