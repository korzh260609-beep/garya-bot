// src/core/projectIntent/projectIntentGuard.js
// ============================================================================
// STAGE 12A.0 — project free-text intent guard (SKELETON, route-aware)
// Purpose:
// - protect SG CORE internal project work only
// - DO NOT block future user-owned project work here
// - always block SG-core write intent in free text (read-only policy)
// - allow SG-core read-only only for monarch + private
// IMPORTANT:
// - this guard protects free-text chat entry only
// - command-level and handler-level guards remain mandatory
// ============================================================================

import { resolveProjectIntentRoute } from "./projectIntentRoute.js";

function buildAccessDeniedText() {
  return [
    "⛔ Внутренняя работа с ядром проекта SG доступна только монарху и только в личке.",
    "Разрешено только чтение, поиск, проверка и анализ в read-only режиме.",
  ].join("\n");
}

function buildWriteDeniedText() {
  return [
    "⛔ Free-text действия записи для ядра проекта SG заблокированы.",
    "Разрешён только read-only режим: чтение, поиск, проверка, анализ, сравнение, подготовка изменений вручную.",
  ].join("\n");
}

export async function requireProjectIntentAccess({
  text,
  isMonarchUser = false,
  isPrivateChat = false,
  replyAndLog,
  resolvedRoute = null,
} = {}) {
  const route =
    resolvedRoute ||
    resolveProjectIntentRoute({
      text,
      isMonarchUser,
      isPrivateChat,
    });

  const match = route.match;

  // Pass-through for anything that is NOT SG core internal.
  // This is critical because future users must be able to work with THEIR projects.
  if (route.targetScope !== "sg_core_internal") {
    return {
      allowed: true,
      blocked: false,
      reason: "not_sg_core_internal",
      route,
      match,
    };
  }

  // Hard policy for SG core internal write-intent:
  // always deny free-text write-like actions for SG core.
  if (route.routeKey === "sg_core_internal_write_denied") {
    if (typeof replyAndLog === "function") {
      await replyAndLog(buildWriteDeniedText(), {
        handler: "projectIntentGuard",
        event: "project_write_intent_denied",
        project_intent_scope: match.targetScope,
        project_intent_domain: match.targetDomain,
        project_intent_action_mode: match.actionMode,
        project_intent_confidence: match.confidence,
        project_intent_route_key: route.routeKey,
        project_intent_policy: route.policy,
        project_intent_anchor_hits: match.anchorHits,
        project_intent_internal_action_hits: match.internalActionHits,
        project_intent_write_action_hits: match.writeActionHits,
        read_only: true,
      });
    }

    return {
      allowed: false,
      blocked: true,
      reason: "project_write_intent_denied",
      route,
      match,
    };
  }

  // SG core internal read-only access:
  // monarch + private only
  if (route.routeKey === "sg_core_internal_read_allowed") {
    return {
      allowed: true,
      blocked: false,
      reason: "project_read_only_allowed",
      route,
      match,
    };
  }

  if (typeof replyAndLog === "function") {
    await replyAndLog(buildAccessDeniedText(), {
      handler: "projectIntentGuard",
      event: "project_intent_denied",
      project_intent_scope: match.targetScope,
      project_intent_domain: match.targetDomain,
      project_intent_action_mode: match.actionMode,
      project_intent_confidence: match.confidence,
      project_intent_route_key: route.routeKey,
      project_intent_policy: route.policy,
      project_intent_anchor_hits: match.anchorHits,
      project_intent_internal_action_hits: match.internalActionHits,
      project_intent_write_action_hits: match.writeActionHits,
      read_only: true,
    });
  }

  return {
    allowed: false,
    blocked: true,
    reason: "project_intent_denied",
    route,
    match,
  };
}

export default {
  requireProjectIntentAccess,
};