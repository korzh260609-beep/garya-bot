// src/core/intentAction/IntentActionRouter.js
// ============================================================================
// STAGE 7A — Intent Action Router skeleton
// Purpose:
// - map already-understood structured intent into internal action metadata
// - prepare a boundary between the future meaning/intent layer and handlers/tools
// - keep normal SG conversation natural-language driven
// - do NOT parse raw user text here
// - do NOT match keywords or fixed phrases here
// - do NOT execute handlers here
// - do NOT connect to runtime here
// ============================================================================

export const INTENT_ACTION_ROUTER_VERSION = 1;

export const INTENT_ACTION_STATUS = Object.freeze({
  ACTIVE: "active",
  SHADOW: "shadow",
  DISABLED: "disabled",
});

export const INTENT_ACTION_SCOPES = Object.freeze({
  GENERAL: "general",
  PROJECT_MEMORY: "project_memory",
  PROJECT_REPO: "project_repo",
  MEMORY_DIAGNOSTICS: "memory_diagnostics",
  SOURCES: "sources",
  SYSTEM: "system",
  DEV: "dev",
});

const DEFAULT_ACTION_STATUS = INTENT_ACTION_STATUS.SHADOW;
const DEFAULT_ACTION_SCOPE = INTENT_ACTION_SCOPES.GENERAL;

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeActionKey(value) {
  const text = safeText(value);
  return text || null;
}

function normalizeIntentKey(value) {
  const text = safeText(value);
  return text || null;
}

function normalizeStatus(value) {
  const text = safeText(value);

  if (Object.values(INTENT_ACTION_STATUS).includes(text)) {
    return text;
  }

  return DEFAULT_ACTION_STATUS;
}

function normalizeScope(value) {
  const text = safeText(value);

  if (Object.values(INTENT_ACTION_SCOPES).includes(text)) {
    return text;
  }

  return DEFAULT_ACTION_SCOPE;
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => safeText(item))
    .filter(Boolean);
}

function clonePlain(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch (_e) {
    return null;
  }
}

function buildAction(input = {}) {
  const actionKey = normalizeActionKey(input.actionKey);

  if (!actionKey) {
    return null;
  }

  return {
    actionKey,
    intentKeys: normalizeStringList(input.intentKeys),
    handlerKey: safeText(input.handlerKey) || null,
    commandKey: safeText(input.commandKey) || null,
    scope: normalizeScope(input.scope),
    status: normalizeStatus(input.status),
    monarchOnly: input.monarchOnly === true,
    privateOnly: input.privateOnly === true,
    requiresTrustedPath: input.requiresTrustedPath === true,
    metadata: clonePlain(input.metadata) || {},
  };
}

function buildNoMatchDecision({ intentKey = null, reason = "no_action_match" } = {}) {
  return {
    ok: true,
    matched: false,
    reason,
    intentKey: normalizeIntentKey(intentKey),
    actionKey: null,
    action: null,
    version: INTENT_ACTION_ROUTER_VERSION,
  };
}

export class IntentActionRouter {
  constructor({ actions = [] } = {}) {
    this.actions = new Map();
    this.intentIndex = new Map();

    for (const action of actions) {
      this.registerAction(action);
    }
  }

  registerAction(input = {}) {
    const action = buildAction(input);

    if (!action) {
      return null;
    }

    this.actions.set(action.actionKey, action);

    for (const intentKey of action.intentKeys) {
      this.intentIndex.set(intentKey, action.actionKey);
    }

    return clonePlain(action);
  }

  getAction(actionKey) {
    const key = normalizeActionKey(actionKey);

    if (!key) {
      return null;
    }

    return clonePlain(this.actions.get(key) || null);
  }

  listActions() {
    return Array.from(this.actions.values()).map((action) => clonePlain(action));
  }

  resolve({ intent = null, intentKey = null } = {}) {
    const structuredIntentKey =
      normalizeIntentKey(intentKey) ||
      normalizeIntentKey(intent?.intentKey) ||
      normalizeIntentKey(intent?.type) ||
      null;

    if (!structuredIntentKey) {
      return buildNoMatchDecision({
        reason: "missing_structured_intent",
      });
    }

    const actionKey = this.intentIndex.get(structuredIntentKey) || null;

    if (!actionKey) {
      return buildNoMatchDecision({
        intentKey: structuredIntentKey,
      });
    }

    const action = this.actions.get(actionKey) || null;

    if (!action) {
      return buildNoMatchDecision({
        intentKey: structuredIntentKey,
        reason: "action_not_found",
      });
    }

    if (action.status === INTENT_ACTION_STATUS.DISABLED) {
      return {
        ok: true,
        matched: false,
        reason: "action_disabled",
        intentKey: structuredIntentKey,
        actionKey: action.actionKey,
        action: clonePlain(action),
        version: INTENT_ACTION_ROUTER_VERSION,
      };
    }

    return {
      ok: true,
      matched: true,
      reason:
        action.status === INTENT_ACTION_STATUS.SHADOW
          ? "matched_shadow_action"
          : "matched_active_action",
      intentKey: structuredIntentKey,
      actionKey: action.actionKey,
      action: clonePlain(action),
      version: INTENT_ACTION_ROUTER_VERSION,
    };
  }

  status() {
    return {
      ok: true,
      version: INTENT_ACTION_ROUTER_VERSION,
      actionCount: this.actions.size,
      intentCount: this.intentIndex.size,
      statuses: Object.values(INTENT_ACTION_STATUS),
      scopes: Object.values(INTENT_ACTION_SCOPES),
    };
  }
}

export default IntentActionRouter;
