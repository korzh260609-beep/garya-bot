// scripts/smokeMessageContextInjectionSystemContext.js
// SG 2.0 smoke test for explicit system-context mode.

import assert from "node:assert/strict";

import {
  MESSAGE_CONTEXT_INJECTION_MODES,
  prepareMessageContextInjection,
} from "../src/core/message/messageContextInjection.js";

const baseMessages = [
  { role: "system", content: "Base system" },
  { role: "user", content: "Base user" },
];

const contextPack = {
  version: 1,
  items: [
    {
      type: "project_memory",
      content: "Project memory is support only. Verified sources remain higher priority.",
      source: "smoke_test",
      trust: "confirmed_memory",
      scope: "sg_project",
      priority: 5,
    },
    {
      type: "user_message",
      content: "Blocked formatter item.",
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
    mode: MESSAGE_CONTEXT_INJECTION_MODES.INJECT_SYSTEM_CONTEXT,
    formatterOptions: {},
  },
});

assert.equal(result.ok, true);
assert.equal(result.mode, MESSAGE_CONTEXT_INJECTION_MODES.INJECT_SYSTEM_CONTEXT);
assert.equal(result.injected, true);
assert.equal(result.messages.length, 3);
assert.deepEqual(result.messages.slice(0, 2), baseMessages);

const extraMessage = result.messages[2];
assert.equal(extraMessage.role, "system");
assert.match(extraMessage.content, /SG_CONTEXT_PACK_BEGIN/);
assert.match(extraMessage.content, /SG_CONTEXT_PACK_END/);
assert.match(extraMessage.content, /type=project_memory/);
assert.match(extraMessage.content, /Verified sources and pillars outrank memory/);
assert.doesNotMatch(extraMessage.content, /Blocked formatter item/);

assert.equal(result.formattedContext.ok, true);
assert.equal(result.formattedContext.itemCount, 1);
assert.deepEqual(result.warnings, []);

console.log("OK: explicit system-context mode appends one bounded context message");
