// scripts/smokeMessageContextInjectionGuards.js
// SG 2.0 smoke test for message context injection guard branches.

import assert from "node:assert/strict";

import { prepareMessageContextInjection } from "../src/core/message/messageContextInjection.js";

const baseMessages = [
  { role: "system", content: "Base system" },
  { role: "user", content: "Base user" },
];

const result = prepareMessageContextInjection({
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

assert.equal(result.ok, false);
assert.equal(result.mode, "unsupported_mode");
assert.equal(result.injected, false);
assert.deepEqual(result.messages, baseMessages);
assert.equal(result.warnings.length, 1);
assert.equal(result.warnings[0].code, "unsupported_context_injection_mode");

console.log("OK: unsupported message context injection mode is rejected");
