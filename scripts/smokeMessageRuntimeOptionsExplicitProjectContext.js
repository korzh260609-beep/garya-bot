// scripts/smokeMessageRuntimeOptionsExplicitProjectContext.js
// SG 2.0 — Message runtime options explicit project context smoke.
// This smoke must stay deterministic, offline, and must not touch DB/network/AI/Telegram/runtime files.
//
// Purpose:
// - Prove explicit project context can enter core only through runtimeOptions.
// - Prove no natural-language project inference is performed here.
// - Prove Telegram-style contexts without runtimeOptions do not select a user project.

import assert from "node:assert/strict";
import {
  buildMessageRuntimeOptions,
  extractMessageText,
} from "../src/core/message/index.js";

const empty = buildMessageRuntimeOptions({});
assert.deepEqual(empty, {
  explicitProjectContext: null,
});

const telegramStyleContext = {
  transport: "telegram",
  chatId: 100,
  userId: 200,
  text: "Открой user_project:global-owner:demo-project",
};

const telegramStyleOptions = buildMessageRuntimeOptions(telegramStyleContext);
assert.equal(extractMessageText(telegramStyleContext), "Открой user_project:global-owner:demo-project");
assert.equal(telegramStyleOptions.explicitProjectContext, null);

const explicitProjectContext = {
  ok: true,
  projectKey: "user_project:global-owner:demo-project",
  project: {
    id: "demo-project",
    ownerGlobalUserId: "global-owner",
    status: "active",
  },
  boundaries: {
    explicitProjectContextOnly: true,
    infersFromNaturalLanguage: false,
  },
};

const explicit = buildMessageRuntimeOptions({
  text: "Normal message with explicit runtime context",
  runtimeOptions: {
    explicitProjectContext,
  },
});

assert.equal(explicit.explicitProjectContext, explicitProjectContext);
assert.equal(explicit.explicitProjectContext.ok, true);
assert.equal(explicit.explicitProjectContext.projectKey, "user_project:global-owner:demo-project");
assert.equal(explicit.explicitProjectContext.boundaries.infersFromNaturalLanguage, false);

const malformedRuntimeOptions = buildMessageRuntimeOptions({
  text: "Malformed runtime options must be ignored",
  runtimeOptions: {
    explicitProjectContext: "user_project:global-owner:demo-project",
  },
});

assert.equal(malformedRuntimeOptions.explicitProjectContext, null);

console.log("smokeMessageRuntimeOptionsExplicitProjectContext: ok");
