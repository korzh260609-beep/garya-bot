// src/memory/context/contextTypes.js
// SG 2.0 — Context Pack Types Skeleton
//
// Purpose:
// - Define stable shape names for AI context packs.
// - Keep this file deterministic and dependency-free.
// - No DB access, no transport logic, no AI calls, no source fetching.

export const CONTEXT_PACK_VERSION = 1;

export const CONTEXT_ITEM_TYPES = Object.freeze({
  USER_MESSAGE: "user_message",
  USER_IDENTITY: "user_identity",
  TASK_INTENT: "task_intent",
  PROJECT_MEMORY: "project_memory",
  REPO_FACT: "repo_fact",
  RUNTIME_FACT: "runtime_fact",
  SESSION_CONTEXT: "session_context",
  CONFIRMED_USER_MEMORY: "confirmed_user_memory",
  SOURCE_FACT: "source_fact",
  PERMISSION_STATE: "permission_state",
  RISK_STATE: "risk_state",
  UNCERTAINTY_NOTE: "uncertainty_note",
});

export const CONTEXT_SOURCE_PRIORITIES = Object.freeze({
  PILLARS: 1,
  REPOSITORY_CURRENT_BRANCH: 2,
  RUNTIME_REPORT: 3,
  COMMIT_PR_ACTION_RENDER_FACT: 4,
  CONFIRMED_PROJECT_MEMORY: 5,
  SESSION_CONTEXT: 6,
  APPROVED_BOUNDED_RAW_RESTORE: 7,
});

export const CONTEXT_TRUST_LEVELS = Object.freeze({
  VERIFIED_SOURCE: "verified_source",
  CONFIRMED_MEMORY: "confirmed_memory",
  SESSION_ONLY: "session_only",
  UNVERIFIED: "unverified",
});

export function createEmptyContextPack({
  requestId = null,
  userId = null,
  chatId = null,
  createdAt = null,
} = {}) {
  return {
    version: CONTEXT_PACK_VERSION,
    requestId: requestId ? String(requestId) : null,
    userId: userId ? String(userId) : null,
    chatId: chatId ? String(chatId) : null,
    createdAt: createdAt || new Date().toISOString(),
    items: [],
    warnings: [],
    limits: {
      maxItems: null,
      maxChars: null,
    },
    meta: {
      builder: "contextPackBuilder",
      skeleton: true,
    },
  };
}

export function createContextItem({
  type,
  content,
  source = null,
  priority = null,
  trust = CONTEXT_TRUST_LEVELS.UNVERIFIED,
  scope = null,
  owner = null,
  metadata = {},
} = {}) {
  return {
    type: type || CONTEXT_ITEM_TYPES.UNCERTAINTY_NOTE,
    content: typeof content === "string" ? content : String(content ?? ""),
    source: source ? String(source) : null,
    priority: Number.isFinite(Number(priority)) ? Number(priority) : null,
    trust,
    scope: scope ? String(scope) : null,
    owner: owner ? String(owner) : null,
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  };
}

export default {
  CONTEXT_PACK_VERSION,
  CONTEXT_ITEM_TYPES,
  CONTEXT_SOURCE_PRIORITIES,
  CONTEXT_TRUST_LEVELS,
  createEmptyContextPack,
  createContextItem,
};
