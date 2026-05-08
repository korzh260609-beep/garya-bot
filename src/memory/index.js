// src/memory/index.js
// SG 2.0 — Memory Public Boundary
//
// Purpose:
// - Provide one stable import surface for SG memory/context modules.
// - Prevent chaotic direct imports from internal memory subfolders.
// - Keep this file dependency-light and deterministic.
//
// Hard rules:
// - Do not add DB access here.
// - Do not add Telegram or transport logic here.
// - Do not add AI provider/model calls here.
// - Do not add source fetching here.
// - Do not turn this file into MemoryService monolith.
// - Runtime integration must happen later through Core Orchestrator -> Memory/Context -> AI Layer.

export {
  CONTEXT_PACK_VERSION,
  CONTEXT_ITEM_TYPES,
  CONTEXT_SOURCE_PRIORITIES,
  CONTEXT_TRUST_LEVELS,
  createEmptyContextPack,
  createContextItem,
} from "./context/contextTypes.js";

export { buildContextPack } from "./context/contextPackBuilder.js";

export {
  CONTEXT_PROMPT_FORMAT_VERSION,
  DEFAULT_CONTEXT_PROMPT_FORMAT_LIMITS,
  formatContextPackForPrompt,
} from "./context/contextPackPromptFormatter.js";

export {
  PROJECT_MEMORY_VERSION,
  PROJECT_MEMORY_TYPES,
  PROJECT_MEMORY_SCOPES,
  PROJECT_MEMORY_TRUST,
  PROJECT_MEMORY_SOURCE_TYPES,
  createProjectMemoryItem,
} from "./project/projectMemoryTypes.js";

export { ProjectMemoryService } from "./project/projectMemoryService.js";

export {
  MEMORY_CONTRACT_VERSION,
  MEMORY_ACTION_CLASSES,
  MEMORY_SCOPES,
  MEMORY_OWNER_TYPES,
  MEMORY_TRANSPORT_TYPES,
  MEMORY_SOURCE_PRIORITIES,
  MEMORY_FAILURE_MODES,
  MEMORY_PRIVACY_LEVELS,
  createMemoryRequestContract,
  createMemoryResultContract,
  createMemoryOwnershipContract,
  getMemoryContractPolicy,
} from "./contracts.js";

export {
  RAW_PROMPT_POLICY_VERSION,
  getRawPromptPolicy,
  assertRawPromptAllowed,
} from "./policies/rawPromptPolicy.js";

export {
  PROJECT_MEMORY_POLICY_VERSION,
  getProjectMemoryPolicy,
  assertProjectMemoryCandidateAllowed,
} from "./policies/projectMemoryPolicy.js";

export {
  CONFIRMED_MEMORY_POLICY_VERSION,
  getConfirmedMemoryPolicy,
  assertConfirmedMemoryAllowed,
} from "./policies/confirmedMemoryPolicy.js";

export {
  GROUP_MEMORY_POLICY_VERSION,
  getGroupMemoryPolicy,
  assertGroupMemoryAllowed,
} from "./policies/groupMemoryPolicy.js";

export function getMemoryModuleStatus() {
  return {
    ok: true,
    module: "memory",
    status: "public_boundary_ready",
    runtimeConnected: false,
    hasDb: false,
    hasTransportLogic: false,
    hasAICalls: false,
    hasSourceFetching: false,
    principles: {
      sourceFirst: true,
      transportIndependent: true,
      telegramIsDeliveryOnly: true,
      globalUserIdOwnsUnifiedUserMemory: true,
      memorySupportsLivingSg: true,
      memoryIsNotCommandRouter: true,
      memoryIsNotTechnicalMode: true,
    },
  };
}

export default {
  getMemoryModuleStatus,
};
