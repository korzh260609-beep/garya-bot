// src/core/runtime/index.js
// SG 2.0 — Core Runtime Public Boundary.
//
// Purpose:
// - Provide one stable import surface for core runtime helpers.
// - Keep runtime context resolution separate from transports, AI, Project Memory writes, and prompt injection.
// - Prevent handleMessage and future transports from importing runtime internals directly.
//
// Hard rules:
// - Do not add transport-specific logic here.
// - Do not read or write Project Memory here.
// - Do not call AI here.
// - Do not fetch external sources here.
// - Do not turn this file into a runtime monolith.

export {
  MESSAGE_RUNTIME_CONTEXT_RESOLVER_VERSION,
  buildMessageRuntimeContextResolverStatus,
  getMessageRuntimeContextResolverBoundaries,
  resolveMessageRuntimeOptions,
} from "./messageRuntimeContextResolver.js";

export function getCoreRuntimeModuleStatus() {
  return {
    ok: true,
    module: "core/runtime",
    status: "public_boundary_ready",
    hasMessageRuntimeContextResolver: true,
    transportIndependent: true,
    hasTransportLogic: false,
    hasAICalls: false,
    hasProjectMemoryReads: false,
    hasProjectMemoryWrites: false,
    hasPromptInjection: false,
    principles: {
      telegramIsDeliveryOnly: true,
      runtimeOptionsAreExplicit: true,
      naturalLanguageInferenceDisabled: true,
      accessAndBehaviorBeforeRuntimeResolution: true,
    },
  };
}

export default {
  getCoreRuntimeModuleStatus,
};
