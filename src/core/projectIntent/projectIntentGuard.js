// src/core/projectIntent/projectIntentGuard.js
// ============================================================================
// STAGE 12A.0 — project free-text intent guard (SKELETON, refined)
// Purpose:
// - block internal SG project/repo/workflow free-text requests
//   for non-monarch users or non-private chats
// - always block project write-intent in free text (read-only policy)
// - allow only read-only internal project requests for monarch in private chat
// IMPORTANT:
// - this guard protects chat free-text entry only
// - command-level and handler-level guards still remain mandatory
// ============================================================================

import { resolveProjectIntentMatch } from "./projectIntentScope.js";

function buildAccessDeniedText() {
  return [
    "⛔ Внутренняя работа с проектом SG доступна только монарху и только в личке.",
    "Разрешено только чтение, поиск, проверка и анализ в read-only режиме.",
  ].join("\n");
}

function buildWriteDeniedText() {
  return [
    "⛔ Free-text действия записи для проекта SG заблокированы.",
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

  // No internal signal -> pass
  if (!match.isProjectInternal && !match.isProjectWriteIntent) {
    return {
      allowed: true,
      blocked: false,
      reason: "not_project_intent",
      match,
    };
  }

  // Hard policy:
  // any detected write-intent for SG internal project work is blocked in free text
  if (match.isProjectWriteIntent) {
    if (typeof replyAndLog === "function") {
      await replyAndLog(buildWriteDeniedText(), {
        handler: "projectIntentGuard",
        event: "project_write_intent_denied",
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

  // Read-only internal project access:
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