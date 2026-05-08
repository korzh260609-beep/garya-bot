// src/memory/context/contextPackBuilder.js
// SG 2.0 — Context Pack Builder Skeleton
//
// Purpose:
// - Build a controlled AI context pack from already provided inputs.
// - This skeleton does not fetch sources, read DB, call AI, or touch transport.
// - Runtime integration must happen later through Core Orchestrator -> Memory/Context -> AI Layer.

import {
  CONTEXT_ITEM_TYPES,
  CONTEXT_SOURCE_PRIORITIES,
  CONTEXT_TRUST_LEVELS,
  createEmptyContextPack,
  createContextItem,
} from "./contextTypes.js";

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function clampText(value, maxChars = null) {
  const text = safeString(value).trim();
  if (!text) return "";
  const limit = Number.isFinite(Number(maxChars)) ? Math.max(1, Number(maxChars)) : null;
  if (!limit || text.length <= limit) return text;
  return `${text.slice(0, limit)}…`;
}

function addItem(pack, item, limits = {}) {
  if (!pack || !Array.isArray(pack.items)) return pack;

  const maxItems = Number.isFinite(Number(limits.maxItems)) ? Number(limits.maxItems) : null;
  if (maxItems && pack.items.length >= maxItems) {
    pack.warnings.push({
      code: "context_item_limit_reached",
      message: "Context item was skipped because maxItems limit was reached.",
    });
    return pack;
  }

  pack.items.push(item);
  return pack;
}

export function buildContextPack({
  requestId = null,
  userId = null,
  chatId = null,
  userMessage = "",
  userIdentity = null,
  taskIntent = null,
  projectMemory = [],
  repoFacts = [],
  runtimeFacts = [],
  sessionContext = [],
  confirmedUserMemory = [],
  sourceFacts = [],
  permissionState = null,
  riskState = null,
  limits = {},
} = {}) {
  const pack = createEmptyContextPack({ requestId, userId, chatId });

  pack.limits = {
    maxItems: Number.isFinite(Number(limits.maxItems)) ? Number(limits.maxItems) : null,
    maxChars: Number.isFinite(Number(limits.maxChars)) ? Number(limits.maxChars) : null,
  };

  const maxChars = pack.limits.maxChars;

  const message = clampText(userMessage, maxChars);
  if (message) {
    addItem(
      pack,
      createContextItem({
        type: CONTEXT_ITEM_TYPES.USER_MESSAGE,
        content: message,
        source: "current_request",
        priority: 0,
        trust: CONTEXT_TRUST_LEVELS.SESSION_ONLY,
        scope: "request",
        owner: userId,
      }),
      pack.limits
    );
  }

  if (userIdentity && typeof userIdentity === "object") {
    addItem(
      pack,
      createContextItem({
        type: CONTEXT_ITEM_TYPES.USER_IDENTITY,
        content: JSON.stringify(userIdentity),
        source: "identity_resolver",
        priority: 0,
        trust: CONTEXT_TRUST_LEVELS.VERIFIED_SOURCE,
        scope: "identity",
        owner: userId,
        metadata: userIdentity,
      }),
      pack.limits
    );
  }

  if (taskIntent) {
    addItem(
      pack,
      createContextItem({
        type: CONTEXT_ITEM_TYPES.TASK_INTENT,
        content: clampText(taskIntent, maxChars),
        source: "intent_detection",
        priority: 0,
        trust: CONTEXT_TRUST_LEVELS.SESSION_ONLY,
        scope: "request",
        owner: userId,
      }),
      pack.limits
    );
  }

  for (const fact of projectMemory || []) {
    addItem(
      pack,
      createContextItem({
        type: CONTEXT_ITEM_TYPES.PROJECT_MEMORY,
        content: clampText(fact?.content ?? fact, maxChars),
        source: fact?.source || "project_memory",
        priority: CONTEXT_SOURCE_PRIORITIES.CONFIRMED_PROJECT_MEMORY,
        trust: CONTEXT_TRUST_LEVELS.CONFIRMED_MEMORY,
        scope: "project",
        owner: "sg_project",
        metadata: fact?.metadata || {},
      }),
      pack.limits
    );
  }

  for (const fact of repoFacts || []) {
    addItem(
      pack,
      createContextItem({
        type: CONTEXT_ITEM_TYPES.REPO_FACT,
        content: clampText(fact?.content ?? fact, maxChars),
        source: fact?.source || "repository_current_branch",
        priority: CONTEXT_SOURCE_PRIORITIES.REPOSITORY_CURRENT_BRANCH,
        trust: CONTEXT_TRUST_LEVELS.VERIFIED_SOURCE,
        scope: "project",
        owner: "sg_project",
        metadata: fact?.metadata || {},
      }),
      pack.limits
    );
  }

  for (const fact of runtimeFacts || []) {
    addItem(
      pack,
      createContextItem({
        type: CONTEXT_ITEM_TYPES.RUNTIME_FACT,
        content: clampText(fact?.content ?? fact, maxChars),
        source: fact?.source || "runtime_report",
        priority: CONTEXT_SOURCE_PRIORITIES.RUNTIME_REPORT,
        trust: CONTEXT_TRUST_LEVELS.VERIFIED_SOURCE,
        scope: "runtime",
        owner: "sg_project",
        metadata: fact?.metadata || {},
      }),
      pack.limits
    );
  }

  for (const item of sessionContext || []) {
    addItem(
      pack,
      createContextItem({
        type: CONTEXT_ITEM_TYPES.SESSION_CONTEXT,
        content: clampText(item?.content ?? item, maxChars),
        source: item?.source || "session_context",
        priority: CONTEXT_SOURCE_PRIORITIES.SESSION_CONTEXT,
        trust: CONTEXT_TRUST_LEVELS.SESSION_ONLY,
        scope: "session",
        owner: userId,
        metadata: item?.metadata || {},
      }),
      pack.limits
    );
  }

  for (const memory of confirmedUserMemory || []) {
    addItem(
      pack,
      createContextItem({
        type: CONTEXT_ITEM_TYPES.CONFIRMED_USER_MEMORY,
        content: clampText(memory?.content ?? memory, maxChars),
        source: memory?.source || "confirmed_user_memory",
        priority: CONTEXT_SOURCE_PRIORITIES.CONFIRMED_PROJECT_MEMORY,
        trust: CONTEXT_TRUST_LEVELS.CONFIRMED_MEMORY,
        scope: "user",
        owner: userId,
        metadata: memory?.metadata || {},
      }),
      pack.limits
    );
  }

  for (const fact of sourceFacts || []) {
    addItem(
      pack,
      createContextItem({
        type: CONTEXT_ITEM_TYPES.SOURCE_FACT,
        content: clampText(fact?.content ?? fact, maxChars),
        source: fact?.source || "external_source",
        priority: fact?.priority || CONTEXT_SOURCE_PRIORITIES.COMMIT_PR_ACTION_RENDER_FACT,
        trust: CONTEXT_TRUST_LEVELS.VERIFIED_SOURCE,
        scope: fact?.scope || "source",
        owner: fact?.owner || null,
        metadata: fact?.metadata || {},
      }),
      pack.limits
    );
  }

  if (permissionState) {
    addItem(
      pack,
      createContextItem({
        type: CONTEXT_ITEM_TYPES.PERMISSION_STATE,
        content: JSON.stringify(permissionState),
        source: "permissions_layer",
        priority: 0,
        trust: CONTEXT_TRUST_LEVELS.VERIFIED_SOURCE,
        scope: "permission",
        owner: userId,
        metadata: typeof permissionState === "object" ? permissionState : {},
      }),
      pack.limits
    );
  }

  if (riskState) {
    addItem(
      pack,
      createContextItem({
        type: CONTEXT_ITEM_TYPES.RISK_STATE,
        content: JSON.stringify(riskState),
        source: "risk_check",
        priority: 0,
        trust: CONTEXT_TRUST_LEVELS.VERIFIED_SOURCE,
        scope: "risk",
        owner: userId,
        metadata: typeof riskState === "object" ? riskState : {},
      }),
      pack.limits
    );
  }

  if (!pack.items.length) {
    pack.warnings.push({
      code: "empty_context_pack",
      message: "No context items were provided. AI layer must answer with uncertainty if facts are needed.",
    });
  }

  return pack;
}

export default {
  buildContextPack,
};
