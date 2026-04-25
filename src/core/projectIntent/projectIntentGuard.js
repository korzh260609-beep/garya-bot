// src/core/projectIntent/projectIntentGuard.js
// ============================================================================
// STAGE 12A.0 — project free-text intent guard (route-aware)
// ============================================================================

import { resolveProjectIntentRoute } from "./projectIntentRoute.js";
import { buildProjectIntentRoutePreview } from "./projectIntentRoutePreview.js";
import { savePendingProjectIntent } from "./projectIntentPendingStore.js";

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

function buildConfirmationText(routePreviewText = "") {
  return [
    "⚠️ Требуется подтверждение монарха.",
    "",
    "Я распознал попытку изменения ядра проекта SG.",
    "",
    routePreviewText ? `Что будет сделано:\n${routePreviewText}` : "",
    "",
    "К чему это приведёт:",
    "- изменение внутренней памяти проекта",
    "- влияние на поведение SG",
    "",
    "Подтвердить выполнение?",
    "Ответь: /confirm_project_action",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function requireProjectIntentAccess({
  text,
  isMonarchUser = false,
  isPrivateChat = false,
  replyAndLog,
  resolvedRoute = null,
  globalUserId = null,
  chatId = null,
  transport = "unknown",
} = {}) {
  const route =
    resolvedRoute ||
    resolveProjectIntentRoute({
      text,
      isMonarchUser,
      isPrivateChat,
    });

  const match = route.match;
  const routePreview = buildProjectIntentRoutePreview(route);

  if (route.targetScope !== "sg_core_internal") {
    return {
      allowed: true,
      blocked: false,
      reason: "not_sg_core_internal",
      route,
      routePreview,
      match,
    };
  }

  if (route.routeKey === "sg_core_internal_write_needs_confirmation") {
    savePendingProjectIntent({
      globalUserId,
      chatId,
      transport,
      text,
      route,
      routePreview,
      match,
    });

    if (typeof replyAndLog === "function") {
      await replyAndLog(buildConfirmationText(routePreview.text), {
        handler: "projectIntentGuard",
        event: "project_write_intent_needs_confirmation",
      });
    }

    return {
      allowed: false,
      blocked: true,
      reason: "project_write_intent_needs_confirmation",
      route,
      routePreview,
      match,
    };
  }

  if (route.routeKey === "sg_core_internal_write_denied") {
    if (typeof replyAndLog === "function") {
      await replyAndLog(buildWriteDeniedText(), {
        handler: "projectIntentGuard",
        event: "project_write_intent_denied",
      });
    }

    return {
      allowed: false,
      blocked: true,
      reason: "project_write_intent_denied",
      route,
      routePreview,
      match,
    };
  }

  if (route.routeKey === "sg_core_internal_read_allowed") {
    return {
      allowed: true,
      blocked: false,
      reason: "project_read_only_allowed",
      route,
      routePreview,
      match,
    };
  }

  if (typeof replyAndLog === "function") {
    await replyAndLog(buildAccessDeniedText(), {
      handler: "projectIntentGuard",
      event: "project_intent_denied",
    });
  }

  return {
    allowed: false,
    blocked: true,
    reason: "project_intent_denied",
    route,
    routePreview,
    match,
  };
}

export default {
  requireProjectIntentAccess,
};
