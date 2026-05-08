// scripts/smokeMessageContextInjectionFormatOnly.js
// SG 2.0 smoke test for format-only message context injection.
//
// Purpose:
// - Prove that FORMAT_ONLY prepares prompt-safe formatted context.
// - Prove that FORMAT_ONLY still does not modify AI messages.
// - Keep this as deterministic smoke coverage, not a runtime feature.

import assert from "node:assert/strict";

import {
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
      content: "SG Project Memory must remain bounded support and must not replace verified sources.",
      source: "smoke_test",
      trust: "confirmed_memory",
      scope: "sg_project",
      priority: 5,
    },
    {
      type: "user_message",
      content: "Raw user message must stay blocked by default formatter policy.",
      source: "smoke_test",
      trust: "raw_input",
      scope: "current_message",
      priority: 1,
    },
  ],
};

const result = prepareMessageContextInjection({
  messages: baseMessages,
  contextPack,
  options: {
    enabled: true,
    mode: MESSAGE_CONTEXT_INJECTION_MODES.FORMAT_ONLY,
    formatterOptions: {},
  },
});

assert.equal(result.ok, true);
assert.equal(result.mode, MESSAGE_CONTEXT_INJECTION_MODES.FORMAT_ONLY);
assert.equal(result.injected, false);
assert.deepEqual(result.messages, baseMessages);
assert.equal(result.messages.length, 2);

assert.equal(result.formattedContext.ok, true);
assert.equal(result.formattedContext.mode, "format_only_not_injected");
assert.equal(result.formattedContext.itemCount, 1);
assert.match(result.formattedContext.text, /SG_CONTEXT_PACK_BEGIN/);
assert.match(result.formattedContext.text, /SG_CONTEXT_PACK_END/);
assert.match(result.formattedContext.text, /type=project_memory/);
assert.match(result.formattedContext.text, /Verified sources and pillars outrank memory/);
assert.doesNotMatch(result.formattedContext.text, /Raw user message must stay blocked/);

console.log("OK: format-only message context injection formats context without changing AI messages");
