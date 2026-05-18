// scripts/smokeMessageProjectMemoryRuntimeVerificationLog.js
// SG 2.0 — Project Memory runtime verification log smoke.
// Purpose: prove normal-message Project Memory gate metadata can be logged safely.
// No DB, no Project Memory writes, no AI calls, no Telegram, no source fetching.

import assert from "node:assert/strict";
import {
  buildProjectMemoryRuntimeVerificationLog,
  emitProjectMemoryRuntimeVerificationLog,
} from "../src/core/message/messageAiRequest.js";

const gate = {
  ok: true,
  mode: "read_only",
  readAttempted: true,
  readOk: true,
  projectKey: "sg",
  projectMemoryFactsCount: 2,
  contextPack: {
    items: [
      { content: "SECRET_USER_TEXT_SHOULD_NOT_LEAK" },
      { content: "SECRET_MEMORY_CONTENT_SHOULD_NOT_LEAK" },
    ],
  },
  projectSelection: {
    explicitProjectContextUsed: false,
  },
  warnings: [
    { code: "safe_warning_code", message: "secret warning message should not be logged" },
  ],
};

const contextInjection = {
  enabled: false,
  messages: [
    { role: "system", content: "system secret should not leak" },
    { role: "user", content: "user secret should not leak" },
  ],
};

const record = buildProjectMemoryRuntimeVerificationLog({
  projectMemoryContextGate: gate,
  contextInjection,
  explicitProjectContext: null,
});

assert.equal(record.ok, true);
assert.equal(record.type, "project_memory_runtime_verification");
assert.equal(record.source, "core.message.callMessageAI");
assert.equal(record.mode, "read_only");
assert.equal(record.enabled, true);
assert.equal(record.readAttempted, true);
assert.equal(record.readOk, true);
assert.equal(record.projectKey, "sg");
assert.equal(record.projectMemoryFactsCount, 2);
assert.equal(record.contextPackItemsCount, 2);
assert.equal(record.promptInjectionEnabled, false);
assert.equal(record.injectedMessageCount, 2);
assert.equal(record.explicitProjectContextUsed, false);
assert.equal(record.explicitProjectContextProvided, false);
assert.deepEqual(record.warningCodes, ["safe_warning_code"]);
assert.equal(record.sanitized, true);

const serialized = JSON.stringify(record);
assert.equal(serialized.includes("SECRET_USER_TEXT_SHOULD_NOT_LEAK"), false);
assert.equal(serialized.includes("SECRET_MEMORY_CONTENT_SHOULD_NOT_LEAK"), false);
assert.equal(serialized.includes("system secret should not leak"), false);
assert.equal(serialized.includes("user secret should not leak"), false);
assert.equal(serialized.includes("secret warning message should not be logged"), false);

const messages = [];
const emitted = emitProjectMemoryRuntimeVerificationLog({
  projectMemoryContextGate: gate,
  contextInjection,
  logger: {
    info: (...args) => messages.push(args),
  },
});

assert.equal(emitted.type, "project_memory_runtime_verification");
assert.equal(messages.length, 1);
assert.equal(messages[0][0], "project_memory_runtime_verification");
assert.equal(typeof messages[0][1], "string");
assert.equal(messages[0][1].includes("SECRET"), false);

let throwLoggerCalled = false;
const emittedWithThrowingLogger = emitProjectMemoryRuntimeVerificationLog({
  projectMemoryContextGate: gate,
  contextInjection,
  logger: {
    info: () => {
      throwLoggerCalled = true;
      throw new Error("logger_failed");
    },
  },
});

assert.equal(throwLoggerCalled, true);
assert.equal(emittedWithThrowingLogger.type, "project_memory_runtime_verification");

console.log("smokeMessageProjectMemoryRuntimeVerificationLog: ok");
