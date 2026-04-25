// src/core/projectIntent/projectIntentRoute.js
// ============================================================================
// STAGE 12A.0 — project free-text route resolver (meaning-first)
// Purpose:
// - build ONE universal route decision above scope-aware classifier
// - separate classification from access decision from future routing
// - keep SG core internal policy strict
// - keep future user-project routing open for later modules
// IMPORTANT:
// - NO command execution here
// - NO repo writes here
// - NO handler side effects here
// - route/result only
// ============================================================================

import { resolveProjectIntentMatch } from "./projectIntentScope.js";

function toBool(value) {
  return value === true;
}

function hasUserProjectSignal(match = {}) {
  return (
    Array.isArray(match.userProjectPhraseHits) && match.userProjectPhraseHits.length > 0
  ) || (
    Array.isArray(match.userProjectTokenHits) && match.userProjectTokenHits.length > 0
  );
}

function shouldRouteMonarchPrivateWriteToSgCore({ match, monarch, priv } = {}) {
  if (!monarch || !priv) return false;
  if (!match || typeof match !== "object") return false;
  if (match.targetScope === "sg_core_internal") return false;
  if (match.actionMode !== "write" && match.actionMode !== "mixed") return false;
  if (hasUserProjectSignal(match)) return false;
  return true;
}

export const PROJECT_INTENT_ROUTE_KEYS = Object.freeze({
  SG_CORE_INTERNAL_READ_ALLOWED: "sg_core_internal_read_allowed",
  SG_CORE_INTERNAL_READ_DENIED: "sg_core_internal_read_denied",
  SG_CORE_INTERNAL_WRITE_NEEDS_CONFIRMATION: "sg_core_internal_write_needs_confirmation",
  SG_CORE_INTERNAL_WRITE_DENIED: "sg_core_internal_write_denied",

  USER_PROJECT_READ: "user_project_read",
  USER_PROJECT_WRITE: "user_project_write",
  USER_PROJECT_MIXED: "user_project_mixed",
  USER_PROJECT_UNKNOWN: "user_project_unknown",

  GENERIC_EXTERNAL_READ: "generic_external_read",
  GENERIC_EXTERNAL_WRITE: "generic_external_write",
  GENERIC_EXTERNAL_MIXED: "generic_external_mixed",
  GENERIC_EXTERNAL_UNKNOWN: "generic_external_unknown",

  UNKNOWN: "unknown",
});

export const PROJECT_INTENT_ROUTE_POLICIES = Object.freeze({
  SG_CORE_READ_ONLY: "sg_core_read_only",
  SG_CORE_CONFIRM_BEFORE_WRITE: "sg_core_confirm_before_write",
  SG_CORE_DENY: "sg_core_deny",

  USER_PROJECT_FUTURE: "user_project_future",
  GENERIC_EXTERNAL_PASS: "generic_external_pass",

  UNKNOWN_PASS: "unknown_pass",
});

export function resolveProjectIntentRoute({
  text,
  isMonarchUser = false,
  isPrivateChat = false,
} = {}) {
  const match = resolveProjectIntentMatch(text);

  const monarch = toBool(isMonarchUser);
  const priv = toBool(isPrivateChat);
  const forceSgCoreWriteConfirmation = shouldRouteMonarchPrivateWriteToSgCore({
    match,
    monarch,
    priv,
  });

  let routeKey = PROJECT_INTENT_ROUTE_KEYS.UNKNOWN;
  let policy = PROJECT_INTENT_ROUTE_POLICIES.UNKNOWN_PASS;

  let allowed = true;
  let blocked = false;
  let requiresMonarch = false;
  let requiresPrivate = false;
  let readOnly = false;
  let needsConfirmation = false;

  if (match.targetScope === "sg_core_internal" || forceSgCoreWriteConfirmation) {
    requiresMonarch = true;
    requiresPrivate = true;

    if (match.isProjectWriteIntent || forceSgCoreWriteConfirmation) {
      readOnly = false;

      if (monarch && priv) {
        routeKey = PROJECT_INTENT_ROUTE_KEYS.SG_CORE_INTERNAL_WRITE_NEEDS_CONFIRMATION;
        policy = PROJECT_INTENT_ROUTE_POLICIES.SG_CORE_CONFIRM_BEFORE_WRITE;
        allowed = false;
        blocked = true;
        needsConfirmation = true;
      } else {
        routeKey = PROJECT_INTENT_ROUTE_KEYS.SG_CORE_INTERNAL_WRITE_DENIED;
        policy = PROJECT_INTENT_ROUTE_POLICIES.SG_CORE_DENY;
        allowed = false;
        blocked = true;
      }
    } else if (monarch && priv) {
      routeKey = PROJECT_INTENT_ROUTE_KEYS.SG_CORE_INTERNAL_READ_ALLOWED;
      policy = PROJECT_INTENT_ROUTE_POLICIES.SG_CORE_READ_ONLY;
      allowed = true;
      blocked = false;
      readOnly = true;
    } else {
      routeKey = PROJECT_INTENT_ROUTE_KEYS.SG_CORE_INTERNAL_READ_DENIED;
      policy = PROJECT_INTENT_ROUTE_POLICIES.SG_CORE_DENY;
      allowed = false;
      blocked = true;
      readOnly = true;
    }
  } else if (match.targetScope === "user_project") {
    policy = PROJECT_INTENT_ROUTE_POLICIES.USER_PROJECT_FUTURE;

    if (match.actionMode === "read") {
      routeKey = PROJECT_INTENT_ROUTE_KEYS.USER_PROJECT_READ;
    } else if (match.actionMode === "write") {
      routeKey = PROJECT_INTENT_ROUTE_KEYS.USER_PROJECT_WRITE;
    } else if (match.actionMode === "mixed") {
      routeKey = PROJECT_INTENT_ROUTE_KEYS.USER_PROJECT_MIXED;
    } else {
      routeKey = PROJECT_INTENT_ROUTE_KEYS.USER_PROJECT_UNKNOWN;
    }

    allowed = true;
    blocked = false;
    readOnly = false;
  } else if (match.targetScope === "generic_external") {
    policy = PROJECT_INTENT_ROUTE_POLICIES.GENERIC_EXTERNAL_PASS;

    if (match.actionMode === "read") {
      routeKey = PROJECT_INTENT_ROUTE_KEYS.GENERIC_EXTERNAL_READ;
    } else if (match.actionMode === "write") {
      routeKey = PROJECT_INTENT_ROUTE_KEYS.GENERIC_EXTERNAL_WRITE;
    } else if (match.actionMode === "mixed") {
      routeKey = PROJECT_INTENT_ROUTE_KEYS.GENERIC_EXTERNAL_MIXED;
    } else {
      routeKey = PROJECT_INTENT_ROUTE_KEYS.GENERIC_EXTERNAL_UNKNOWN;
    }

    allowed = true;
    blocked = false;
    readOnly = false;
  }

  return {
    match,

    routeKey,
    policy,

    allowed,
    blocked,

    requiresMonarch,
    requiresPrivate,
    readOnly,
    needsConfirmation,
    forceSgCoreWriteConfirmation,

    targetScope: forceSgCoreWriteConfirmation ? "sg_core_internal" : match.targetScope,
    targetDomain: forceSgCoreWriteConfirmation ? "sg_internal_project" : match.targetDomain,
    actionMode: match.actionMode,
    confidence: forceSgCoreWriteConfirmation ? "medium" : match.confidence,
  };
}

export default {
  PROJECT_INTENT_ROUTE_KEYS,
  PROJECT_INTENT_ROUTE_POLICIES,
  resolveProjectIntentRoute,
};
