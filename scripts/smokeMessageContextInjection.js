// scripts/smokeMessageContextInjection.js
// SG 2.0 smoke test for disabled message context injection.
//
// Purpose:
// - Prove that disabled context injection does not modify AI messages.
// - Keep this as deterministic smoke coverage, not a runtime feature.

import assert from "node:assert/strict";

import {
  buildMessageContextInjectionDisabledOptions,
  MESSAGE_CONTEXT_INJECTION_MODES,
  prepareMessageContextInjection,
} from "../src/core/message/messageContextInjection.js";

const baseMessages = [
  { role: "system", content: "System prompt" },
  { role: "user", content: "User message" },
];

const contextPack = {
  version: 1,
  items: [
    {
      type: "project_memory",
      content: "This item must not be injected while injection is disabled.",
      source: "smoke_test",
      trust: "confirmed_memory",
      scope: "test",
      priority: 5,
    },
  ],
};

const result = prepareMessageContextInjection({
  messages: baseMessages,
  contextPack,
  options: buildMessageContextInjectionDisabledOptions(),
});

assert.equal(result.ok, true);
assert.equal(result.mode, MESSAGE_CONTEXT_INJECTION_MODES.DISABLED);
assert.equal(result.injected, false);
assert.equal(result.formattedContext, null);
assert.deepEqual(result.warnings, []);
assert.deepEqual(result.messages, baseMessages);
assert.equal(result.messages.length, 2);
assert.equal(result.messages[0].content, "System prompt");
assert.equal(result.messages[1].content, "User message");

console.log("OK: disabled message context injection leaves AI messages unchanged");
