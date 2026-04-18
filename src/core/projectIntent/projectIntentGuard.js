// src/core/projectIntent/projectIntentGuard.js
// ============================================================================
// STAGE 12A.0 — project free-text intent guard (SKELETON)
// Purpose:
// - block internal SG project/repo/workflow free-text requests
//   for non-monarch users or non-private chats
// - allow such requests only for monarch in private chat
// - policy remains READ-ONLY
// IMPORTANT:
// - this guard only protects chat free-text intent entry
// - it does NOT execute repo actions
// - it does NOT replace command-level or handler-level guards
// ============================================================================

import { resolveProjectIntentMatch } from "./projectIntentScope.js";

function buildDeniedText() {
  return [
    "⛔ Внутренняя работа с проектом SG доступна только монарху и только в личке.",
    "Разрешено только чтение/поиск/анализ в read-only режиме.",
  ].join("\n");
}

export async function requireProjectIntentAccess({
  text,
  isMonarchUser = false,
  isPrivateChat = false,
  replyAndLog,
} = {}) {
  const match = resolveProjectIntentMatch(text);

  if (!match.isProjectInternal) {
    return {
      allowed: true,
      blocked: false,
      match,
    };
  }

  if (isMonarchUser && isPrivateChat) {
    return {
      allowed: true,
      blocked: false,
      match,
    };
  }

  if (typeof replyAndLog === "function") {
    await replyAndLog(buildDeniedText(), {
      handler: "projectIntentGuard",
      event: "project_intent_denied",
      project_intent_confidence: match.confidence,
      project_intent_strong_hits: match.strongHits,
      project_intent_weak_hits: match.weakHits,
      read_only: true,
    });
  }

  return {
    allowed: false,
    blocked: true,
    match,
  };
}

export default {
  requireProjectIntentAccess,
};