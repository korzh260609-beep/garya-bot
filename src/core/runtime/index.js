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

export { getCoreRuntimeModuleStatus } from "./coreRuntimeStatus.js";

export {
  MESSAGE_RUNTIME_CONTEXT_RESOLVER_VERSION,
  buildMessageRuntimeContextResolverStatus,
  getMessageRuntimeContextResolverBoundaries,
  resolveMessageRuntimeOptions,
} from "./messageRuntimeContextResolver.js";

export {
  CORE_RUNTIME_DIAGNOSTICS_VERSION,
  buildCoreRuntimeDiagnostics,
} from "./runtimeDiagnostics.js";

export default {};
