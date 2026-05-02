// src/core/living-sg/LivingRepoFactsSourceHonestyReplyBuilder.js
// ============================================================================
// LIVING SG — Repo Facts Source-Honesty User Reply Builder
//
// Purpose:
// - keep technical source-honesty guard decisions separate from user-facing text;
// - turn a blocked generic-AI repo facts answer into a Living SG reply;
// - avoid leaking internal fallback/debug reasons into Telegram/user responses.
//
// Boundaries:
// - no repository reads;
// - no repository writes;
// - no source calls;
// - no executor;
// - no AI call;
// - no slash-command routing;
// - no keyword/phrase router.
// ============================================================================

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.replace(/\s+/g, " ").slice(0, 240);
}

function safeNumber(value, fallback = "не подтверждено") {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : fallback;
}

function hasConfirmedSourceEnvelope(sourceResultEnvelope = null) {
  return (
    isPlainObject(sourceResultEnvelope) &&
    sourceResultEnvelope.canClaimVerifiedFacts === true &&
    sourceResultEnvelope?.confirmation?.status === "confirmed"
  );
}

function getProjectMap(sourceResultEnvelope = null) {
  const payload = sourceResultEnvelope?.payload;
  if (!isPlainObject(payload)) return null;
  if (isPlainObject(payload.projectMap)) return payload.projectMap;
  if (isPlainObject(payload.payload?.projectMap)) return payload.payload.projectMap;
  return null;
}

function resolveMissingDataLine(factNeed = "") {
  switch (safeText(factNeed)) {
    case "repo_root_listing":
      return "Точный список элементов в корне репозитория пока не отдан verified-источником в отдельном виде.";
    case "repo_file_listing":
      return "Точный список файлов пока не отдан verified-источником в отдельном виде.";
    case "repo_structure":
      return "Полная структура в нужном для ответа виде пока не отдана verified-источником.";
    case "repo_count":
      return "Нужное точное количество пока не отдано verified-источником в поддержанном виде.";
    case "repo_status":
      return "Точный статус репозитория пока не отдан verified-источником в поддержанном виде.";
    default:
      return "Нужные точные данные пока не отданы verified-источником в поддержанном виде.";
  }
}

function resolveNextStepLine(factNeed = "") {
  switch (safeText(factNeed)) {
    case "repo_root_listing":
      return "Следующий шаг — добавить отдельный обработчик списка корневых папок и файлов.";
    case "repo_file_listing":
      return "Следующий шаг — добавить отдельный обработчик списка файлов.";
    case "repo_structure":
      return "Следующий шаг — расширить обработчик структуры репозитория.";
    default:
      return "Следующий шаг — добавить отдельный обработчик этого типа repo-данных.";
  }
}

export function buildRepoFactsSourceHonestyBlockedReply({
  sourceResultEnvelope = null,
  guardResult = null,
} = {}) {
  const confirmed = hasConfirmedSourceEnvelope(sourceResultEnvelope);
  const projectMap = getProjectMap(sourceResultEnvelope);
  const repo = projectMap?.repo || {};
  const totals = projectMap?.totals || {};
  const factNeed = safeText(guardResult?.factNeed || "other_repo_fact");

  const lines = [
    "Не буду придумывать.",
    confirmed
      ? `Я вижу подтверждённую карту репозитория ${safeText(repo.fullName, "проекта")} на ветке ${safeText(repo.branch, "unknown")}.`
      : "Подтверждённый источник по текущему состоянию репозитория сейчас недоступен.",
    resolveMissingDataLine(factNeed),
  ];

  if (projectMap) {
    lines.push(
      "",
      "Что подтверждено сейчас:",
      `- файлов всего: ${safeNumber(totals.files)}`,
      `- модулей: ${safeNumber(totals.modules)}`,
      `- зависимостей: ${safeNumber(totals.dependencies)}`,
      `- структура: ${totals.structureComplete === true ? "подтверждена" : "не подтверждена полностью"}`
    );
  }

  lines.push("", resolveNextStepLine(factNeed));

  return {
    handled: true,
    source: "LivingRepoFactsSourceHonestyReplyBuilder",
    reason: "human_living_reply_for_blocked_repo_facts",
    text: lines.filter(Boolean).join("\n"),
    metadata: {
      userFacingReplyBuiltSeparately: true,
      technicalGuardTextHidden: true,
      factNeed,
    },
  };
}

export default {
  buildRepoFactsSourceHonestyBlockedReply,
};
