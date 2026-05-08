// src/memory/contracts.js
// SG 2.0 — Memory + Context Contracts Skeleton
//
// Purpose:
// - Define shared contracts for memory/context modules before runtime integration.
// - Keep this file deterministic and dependency-free.
// - No DB access, no transport logic, no Telegram dependency, no AI calls, no source fetching.
//
// Core rule:
// SG memory/context contracts are transport-independent.
// Telegram is only one delivery channel, not a memory owner and not an architectural dependency.
// Future transports must connect through the same contract shape.

export const MEMORY_CONTRACT_VERSION = 1;

export const MEMORY_ACTION_CLASSES = Object.freeze({
  READ_ONLY: "read_only",
  ANALYSIS_ONLY: "analysis_only",
  PREPARE_ONLY: "prepare_only",
  STATE_CHANGING: "state_changing",
  EXTERNAL_ACTION: "external_action",
  PRIVATE_DATA: "private_data",
  EXPENSIVE: "expensive",
});

export const MEMORY_SCOPES = Object.freeze({
  PROJECT: "project",
  USER: "user",
  GROUP: "group",
  SESSION: "session",
  RAW_ARCHIVE: "raw_archive",
  TOPIC_DIGEST: "topic_digest",
  SOURCE_FACT: "source_fact",
});

export const MEMORY_OWNER_TYPES = Object.freeze({
  SG_PROJECT: "sg_project",
  USER: "user",
  GROUP: "group",
  SYSTEM: "system",
  UNKNOWN: "unknown",
});

export const MEMORY_TRANSPORT_TYPES = Object.freeze({
  TRANSPORT_AGNOSTIC: "transport_agnostic",
  TELEGRAM: "telegram",
  WEB: "web",
  API: "api",
  GITHUB: "github",
  IDE: "ide",
  CLI: "cli",
  FUTURE: "future",
});

export const MEMORY_SOURCE_PRIORITIES = Object.freeze({
  PILLARS: 1,
  REPOSITORY_CURRENT_BRANCH: 2,
  RUNTIME_REPORT: 3,
  COMMIT_PR_ACTION_RENDER_FACT: 4,
  CONFIRMED_PROJECT_MEMORY: 5,
  CONFIRMED_USER_MEMORY: 6,
  SESSION_CONTEXT: 7,
  APPROVED_BOUNDED_RAW_RESTORE: 8,
});

export const MEMORY_FAILURE_MODES = Object.freeze({
  FAIL_CLOSED: "fail_closed",
  FAIL_OPEN_WITH_WARNING: "fail_open_with_warning",
  RETURN_EMPTY_WITH_WARNING: "return_empty_with_warning",
  REQUIRE_MONARCH_APPROVAL: "require_monarch_approval",
});

export const MEMORY_PRIVACY_LEVELS = Object.freeze({
  PUBLIC_PROJECT: "public_project",
  PROJECT_INTERNAL: "project_internal",
  USER_PRIVATE: "user_private",
  GROUP_SHARED: "group_shared",
  SECRET_BLOCKED: "secret_blocked",
});

export function createMemoryRequestContract({
  requestId = null,
  actor = null,
  transport = MEMORY_TRANSPORT_TYPES.TRANSPORT_AGNOSTIC,
  actionClass = MEMORY_ACTION_CLASSES.READ_ONLY,
  scope = MEMORY_SCOPES.PROJECT,
  ownerType = MEMORY_OWNER_TYPES.UNKNOWN,
  ownerId = null,
  input = {},
  metadata = {},
} = {}) {
  return {
    version: MEMORY_CONTRACT_VERSION,
    requestId: requestId ? String(requestId) : null,
    actor: actor && typeof actor === "object" ? actor : null,
    transport: transport || MEMORY_TRANSPORT_TYPES.TRANSPORT_AGNOSTIC,
    actionClass,
    scope,
    ownerType,
    ownerId: ownerId ? String(ownerId) : null,
    input: input && typeof input === "object" ? input : {},
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    rules: {
      transportIndependent: true,
      telegramIsDeliveryOnly: true,
      memoryDoesNotOwnTransport: true,
      memoryDoesNotOwnAIProvider: true,
      memoryDoesNotOverrideSources: true,
    },
  };
}

export function createMemoryResultContract({
  ok = true,
  actionClass = MEMORY_ACTION_CLASSES.READ_ONLY,
  scope = MEMORY_SCOPES.PROJECT,
  items = [],
  warnings = [],
  errors = [],
  failureMode = MEMORY_FAILURE_MODES.RETURN_EMPTY_WITH_WARNING,
  metadata = {},
} = {}) {
  return {
    version: MEMORY_CONTRACT_VERSION,
    ok: Boolean(ok),
    actionClass,
    scope,
    items: Array.isArray(items) ? items : [],
    warnings: Array.isArray(warnings) ? warnings : [],
    errors: Array.isArray(errors) ? errors : [],
    failureMode,
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  };
}

export function createMemoryOwnershipContract({
  ownerType = MEMORY_OWNER_TYPES.UNKNOWN,
  ownerId = null,
  privacy = MEMORY_PRIVACY_LEVELS.PROJECT_INTERNAL,
  scope = MEMORY_SCOPES.PROJECT,
  attribution = null,
  metadata = {},
} = {}) {
  return {
    version: MEMORY_CONTRACT_VERSION,
    ownerType,
    ownerId: ownerId ? String(ownerId) : null,
    privacy,
    scope,
    attribution: attribution && typeof attribution === "object" ? attribution : null,
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  };
}

export function getMemoryContractPolicy() {
  return {
    version: MEMORY_CONTRACT_VERSION,
    transport: {
      independent: true,
      telegramIsOnlyOneChannel: true,
      futureTransportsAllowed: true,
      forbidden: [
        "store_memory_as_telegram_only",
        "make_telegram_the_memory_owner",
        "put_transport_logic_inside_memory",
        "make_ai_context_depend_on_one_transport",
      ],
    },
    safety: {
      rawChatIsNotConfirmedMemory: true,
      memoryDoesNotReplaceSources: true,
      projectMemoryDoesNotReplacePillars: true,
      secretsMustNotEnterMemoryContext: true,
      rawArchiveNotPromptFacingByDefault: true,
    },
    livingSg: {
      memorySupportsLivingSg: true,
      memoryMustNotBecomeCommandRouter: true,
      memoryMustNotBecomeTechnicalMode: true,
      contextBuilderIsNotSgBrain: true,
    },
  };
}

export default {
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
};
