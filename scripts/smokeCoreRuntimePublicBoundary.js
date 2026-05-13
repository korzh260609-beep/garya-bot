// scripts/smokeCoreRuntimePublicBoundary.js
// SG 2.0 — Core runtime public boundary smoke.
// This smoke must stay deterministic, offline, and must not touch DB/network/AI/Telegram/runtime files.
//
// Purpose:
// - Prove core/runtime has a stable public boundary.
// - Prove handleMessage can import runtime helpers through the boundary.
// - Prove the boundary remains transport-independent and has no AI or memory writes.

import assert from "node:assert/strict";
import {
  MESSAGE_RUNTIME_CONTEXT_RESOLVER_VERSION,
  buildMessageRuntimeContextResolverStatus,
  getCoreRuntimeModuleStatus,
  getMessageRuntimeContextResolverBoundaries,
  resolveMessageRuntimeOptions,
} from "../src/core/runtime/index.js";

assert.equal(typeof MESSAGE_RUNTIME_CONTEXT_RESOLVER_VERSION, "number");
assert.equal(typeof resolveMessageRuntimeOptions, "function");
assert.equal(typeof buildMessageRuntimeContextResolverStatus, "function");
assert.equal(typeof getMessageRuntimeContextResolverBoundaries, "function");
assert.equal(typeof getCoreRuntimeModuleStatus, "function");

const moduleStatus = getCoreRuntimeModuleStatus();
assert.equal(moduleStatus.ok, true);
assert.equal(moduleStatus.module, "core/runtime");
assert.equal(moduleStatus.status, "public_boundary_ready");
assert.equal(moduleStatus.hasMessageRuntimeContextResolver, true);
assert.equal(moduleStatus.transportIndependent, true);
assert.equal(moduleStatus.hasTransportLogic, false);
assert.equal(moduleStatus.hasAICalls, false);
assert.equal(moduleStatus.hasProjectMemoryReads, false);
assert.equal(moduleStatus.hasProjectMemoryWrites, false);
assert.equal(moduleStatus.hasPromptInjection, false);
assert.equal(moduleStatus.principles.telegramIsDeliveryOnly, true);
assert.equal(moduleStatus.principles.runtimeOptionsAreExplicit, true);
assert.equal(moduleStatus.principles.naturalLanguageInferenceDisabled, true);
assert.equal(moduleStatus.principles.accessAndBehaviorBeforeRuntimeResolution, true);

const resolverStatus = buildMessageRuntimeContextResolverStatus();
assert.equal(resolverStatus.ok, true);
assert.equal(resolverStatus.module, "core/runtime");
assert.equal(resolverStatus.boundaries.transportIndependent, true);
assert.equal(resolverStatus.boundaries.infersFromNaturalLanguage, false);
assert.equal(resolverStatus.boundaries.callsAI, false);
assert.equal(resolverStatus.boundaries.writesProjectMemory, false);

const boundaries = getMessageRuntimeContextResolverBoundaries();
assert.equal(boundaries.transportIndependent, true);
assert.equal(boundaries.explicitProjectContextOnly, true);
assert.equal(boundaries.infersFromNaturalLanguage, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.writesProjectMemory, false);

const runtimeOptions = await resolveMessageRuntimeOptions({
  context: {
    transport: "telegram",
    text: "Открой user_project:global-owner:demo-project",
  },
  identity: {
    globalUserId: "global-owner",
    platform: "telegram",
    platformUserId: "111",
    role: "citizen",
    isMonarch: false,
  },
});

assert.equal(runtimeOptions.ok, true);
assert.equal(runtimeOptions.explicitProjectContext, null);
assert.equal(runtimeOptions.explicitProjectContextSource, null);
assert.equal(runtimeOptions.warnings.length, 0);

console.log("smokeCoreRuntimePublicBoundary: ok");
