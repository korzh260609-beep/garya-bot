// scripts/smokeMessageRuntimeContextResolver.js
// SG 2.0 — Message runtime context resolver smoke.
// This smoke must stay deterministic, offline, and must not touch DB/network/AI/Telegram/runtime files.
//
// Purpose:
// - Prove message runtime context resolution is transport-independent.
// - Prove direct runtimeOptions.explicitProjectContext still passes through unchanged.
// - Prove explicit user project context request can be resolved before message AI.
// - Prove natural-language text does not create project context.

import assert from "node:assert/strict";
import {
  MESSAGE_RUNTIME_CONTEXT_RESOLVER_VERSION,
  buildMessageRuntimeContextResolverStatus,
  getMessageRuntimeContextResolverBoundaries,
  resolveMessageRuntimeOptions,
} from "../src/core/runtime/messageRuntimeContextResolver.js";

const status = buildMessageRuntimeContextResolverStatus();
assert.equal(status.ok, true);
assert.equal(status.module, "core/runtime");
assert.equal(status.version, MESSAGE_RUNTIME_CONTEXT_RESOLVER_VERSION);
assert.equal(status.boundaries.transportIndependent, true);
assert.equal(status.boundaries.infersFromNaturalLanguage, false);
assert.equal(status.boundaries.readsProjectMemory, false);
assert.equal(status.boundaries.writesProjectMemory, false);
assert.equal(status.boundaries.callsAI, false);
assert.equal(status.boundaries.injectsPromptContext, false);

const boundaries = getMessageRuntimeContextResolverBoundaries();
assert.equal(boundaries.transportIndependent, true);
assert.equal(boundaries.explicitProjectContextOnly, true);
assert.equal(boundaries.infersFromNaturalLanguage, false);

const noContext = await resolveMessageRuntimeOptions({
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

assert.equal(noContext.ok, true);
assert.equal(noContext.explicitProjectContext, null);
assert.equal(noContext.explicitProjectContextSource, null);
assert.equal(noContext.warnings.length, 0);

const directExplicitProjectContext = {
  ok: true,
  projectKey: "user_project:global-owner:demo-project",
  project: {
    id: "demo-project",
    ownerGlobalUserId: "global-owner",
    status: "active",
  },
};

const direct = await resolveMessageRuntimeOptions({
  context: {
    transport: "api",
    text: "Normal API message",
    runtimeOptions: {
      explicitProjectContext: directExplicitProjectContext,
    },
  },
  identity: {
    globalUserId: "global-owner",
    platform: "api",
    platformUserId: "api-user-1",
    role: "citizen",
    isMonarch: false,
  },
});

assert.equal(direct.ok, true);
assert.equal(direct.explicitProjectContext, directExplicitProjectContext);
assert.equal(direct.explicitProjectContextSource, "runtime_options_explicit_project_context");
assert.equal(direct.warnings.length, 0);

const resolverCalls = [];
const fakeUserProjectRuntimeContextResolver = {
  async resolveExplicitUserProjectContext(input = {}) {
    resolverCalls.push(input);

    return {
      ok: true,
      version: 1,
      reason: null,
      actor: input.actor,
      input: {
        ownerGlobalUserId: input.ownerGlobalUserId,
        userProjectId: input.userProjectId,
      },
      project: {
        id: input.userProjectId,
        ownerGlobalUserId: input.ownerGlobalUserId,
        status: "active",
      },
      projectKey: `user_project:${input.ownerGlobalUserId}:${input.userProjectId}`,
      boundaries: {
        explicitProjectContextOnly: true,
        infersFromNaturalLanguage: false,
      },
    };
  },
};

const resolved = await resolveMessageRuntimeOptions({
  context: {
    transport: "web",
    text: "Open explicit project request",
    runtimeOptions: {
      explicitUserProjectContextRequest: {
        ownerGlobalUserId: "global-owner",
        userProjectId: "demo-project",
      },
    },
  },
  identity: {
    globalUserId: "global-owner",
    platform: "web",
    platformUserId: "web-user-1",
    role: "citizen",
    isMonarch: false,
  },
  userProjectRuntimeContextResolver: fakeUserProjectRuntimeContextResolver,
});

assert.equal(resolved.ok, true);
assert.equal(resolved.explicitProjectContext.ok, true);
assert.equal(resolved.explicitProjectContext.projectKey, "user_project:global-owner:demo-project");
assert.equal(resolved.explicitProjectContextSource, "explicit_user_project_context_request");
assert.equal(resolverCalls.length, 1);
assert.equal(resolverCalls[0].actor.globalUserId, "global-owner");
assert.equal(resolverCalls[0].actor.platform, "web");
assert.equal(resolverCalls[0].actor.platformUserId, "web-user-1");
assert.equal(resolverCalls[0].actor.role, "citizen");
assert.equal(resolverCalls[0].actor.isMonarch, false);
assert.equal(resolverCalls[0].ownerGlobalUserId, "global-owner");
assert.equal(resolverCalls[0].userProjectId, "demo-project");

const deniedResolver = {
  async resolveExplicitUserProjectContext() {
    return {
      ok: false,
      reason: "user_project_runtime_context_owner_mismatch",
    };
  },
};

const denied = await resolveMessageRuntimeOptions({
  context: {
    transport: "api",
    text: "Denied explicit request",
    runtimeOptions: {
      explicitUserProjectContextRequest: {
        ownerGlobalUserId: "global-owner",
        userProjectId: "demo-project",
      },
    },
  },
  identity: {
    globalUserId: "other-user",
    platform: "api",
    platformUserId: "api-user-2",
    role: "citizen",
    isMonarch: false,
  },
  userProjectRuntimeContextResolver: deniedResolver,
});

assert.equal(denied.ok, true);
assert.equal(denied.explicitProjectContext, null);
assert.equal(denied.explicitProjectContextSource, null);
assert.equal(denied.warnings.length, 1);
assert.equal(denied.warnings[0].code, "explicit_user_project_context_request_denied");
assert.equal(denied.warnings[0].reason, "user_project_runtime_context_owner_mismatch");

console.log("smokeMessageRuntimeContextResolver: ok");
