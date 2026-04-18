// src/core/projectIntent/projectIntentGuard.js
// ============================================================================
// STAGE 12A.0 — project free-text intent guard (SKELETON, scope-aware)
// Purpose:
// - protect SG CORE internal project work only
// - DO NOT block future user-owned project work here
// - always block SG-core write intent in free text (read-only policy)
// - allow SG-core read-only only for monarch + private
// IMPORTANT:
// - this guard protects free-text chat entry only
// - command-level and handler-level guards remain mandatory
// ============================================================================

import { resolveProjectIntentMatch } from "./projectIntentScope.js";

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
} = {}) {
  const match = resolveProjectIntentMatch(text);

  // Pass-through for anything that is NOT SG core internal.
  // This is critical because future users must be able to work with THEIR projects.
  if (match.targetScope !== "sg_core_internal") {
    return {
      allowed: true,
      blocked: false,
      reason: "not_sg_core_internal",
      match,
    };
  }

  // Hard policy for SG core internal write-intent:
  // always deny free-text write-like actions for SG core.
  if (match.isProjectWriteIntent) {
    if (typeof replyAndLog === "function") {
      await replyAndLog(buildWriteDeniedText(), {
        handler: "projectIntentGuard",
        event: "project_write_intent_denied",
        project_intent_scope: match.targetScope,
        project_intent_confidence: match.confidence,
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
      match,
    };
  }

  // SG core internal read-only access:
  // monarch + private only
  if (isMonarchUser && isPrivateChat) {
    return {
      allowed: true,
      blocked: false,
      reason: "project_read_only_allowed",
      match,
    };
  }

  if (typeof replyAndLog === "function") {
    await replyAndLog(buildAccessDeniedText(), {
      handler: "projectIntentGuard",
      event: "project_intent_denied",
      project_intent_scope: match.targetScope,
      project_intent_confidence: match.confidence,
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
    match,
  };
}

export default {
  requireProjectIntentAccess,
};