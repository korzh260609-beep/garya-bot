// src/core/projectIntent/projectDiagnosticNaturalBridge.js
// ============================================================================
// Project Diagnostic Natural Bridge
// Purpose:
// - User speaks normal language to SG.
// - SG internally calls RepoStateAgent with safe no-real-AI options.
// - Reply stays human-readable and transport-agnostic.
//
// Boundary:
// - NO slash-command dependency.
// - NO Telegram dependency.
// - NO real AI spending.
// - NO repo writes.
// - NO pillars edits.
// ============================================================================

import { RepoStateAgentService } from "../../simpleAgents/repoStateAgent/RepoStateAgentService.js";

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasAny(text, markers = []) {
  return markers.some((marker) => text.includes(marker));
}

function safeNumber(value, fallback = "-") {
  return Number.isFinite(value) ? String(value) : fallback;
}

function boolText(value) {
  return value === true ? "так" : "ні";
}

function countBySeverity(findings = [], severity) {
  return asArray(findings).filter((item) => item?.severity === severity).length;
}

function buildTopFindingsText(findings = [], limit = 3) {
  const top = asArray(findings)
    .filter((item) => ["critical", "high", "medium"].includes(item?.severity))
    .slice(0, limit);

  if (!top.length) return "- явних критичних пунктів не знайдено";

  return top
    .map((item) => `- ${item.title || item.id || "risk"}`)
    .join("\n");
}

function buildNextStepsText(steps = [], limit = 3) {
  const top = asArray(steps).slice(0, limit);
  if (!top.length) return "- наступний крок не визначений";

  return top
    .map((item) => `- ${item.title || item.id || "next step"}`)
    .join("\n");
}

function classifyDiagnosticNeed({ text, route } = {}) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return { shouldHandle: false, reason: "empty_text", mode: "none" };
  }

  const routeTarget = route?.targetScope || "unknown";
  const routeAction = route?.actionMode || "unknown";
  const routeReadAllowed = routeTarget === "sg_core_internal" && routeAction !== "write" && routeAction !== "mixed";

  const projectStateSignals = [
    "состояние проекта",
    "стан проекту",
    "стан проекта",
    "проект сейчас",
    "що з проектом",
    "что с проектом",
    "project state",
    "project status",
    "state of project",
  ];

  const architectureSignals = [
    "архитектур",
    "architecture",
    "architectural",
    "структура проекта",
    "структура проєкту",
    "структура сг",
    "структура sg",
  ];

  const riskSignals = [
    "риск",
    "ризик",
    "опасн",
    "небезп",
    "слабые места",
    "слабкі місця",
    "проблем",
    "что сломано",
    "що зламано",
    "risk",
    "risks",
    "problem",
    "problems",
  ];

  const nextStepSignals = [
    "куда дальше",
    "куди далі",
    "что дальше",
    "що далі",
    "следующий шаг",
    "наступний крок",
    "next step",
    "next action",
    "road ahead",
  ];

  const selfCheckSignals = [
    "проверь себя",
    "перевір себе",
    "самодиагност",
    "самодіагност",
    "диагностик",
    "діагностик",
    "проверь сг",
    "перевір сг",
    "check sg",
    "self check",
    "selfcheck",
  ];

  const repoStateSignals = [
    "репозитор",
    "repo",
    "repository",
    "github",
    "код проекта",
    "код проєкту",
    "garya-bot",
  ];

  const wantsProjectState = hasAny(normalized, projectStateSignals);
  const wantsArchitecture = hasAny(normalized, architectureSignals);
  const wantsRisks = hasAny(normalized, riskSignals);
  const wantsNextStep = hasAny(normalized, nextStepSignals);
  const wantsSelfCheck = hasAny(normalized, selfCheckSignals);
  const wantsRepoState = hasAny(normalized, repoStateSignals) && (
    normalized.includes("проверь") ||
    normalized.includes("перевір") ||
    normalized.includes("check") ||
    normalized.includes("анализ") ||
    normalized.includes("аналіз") ||
    normalized.includes("состояние") ||
    normalized.includes("стан")
  );

  if (!(wantsProjectState || wantsArchitecture || wantsRisks || wantsNextStep || wantsSelfCheck || wantsRepoState)) {
    return { shouldHandle: false, reason: "no_diagnostic_meaning", mode: "none" };
  }

  if (routeTarget !== "sg_core_internal" && !wantsSelfCheck && !wantsProjectState && !wantsArchitecture) {
    return { shouldHandle: false, reason: "not_sg_project_scope", mode: "none" };
  }

  if (!routeReadAllowed && routeTarget === "sg_core_internal") {
    return { shouldHandle: false, reason: "not_read_only", mode: "none" };
  }

  let mode = "summary";
  if (wantsArchitecture || wantsRisks || wantsSelfCheck) mode = "architecture_health";
  if (wantsNextStep) mode = "next_action_plan";
  if (wantsProjectState || wantsRepoState) mode = "project_state";

  return {
    shouldHandle: true,
    reason: "project_diagnostic_natural_language",
    mode,
  };
}

function buildHumanDiagnosticReply({ result, mode } = {}) {
  const projectMap = result?.projectMap || {};
  const semanticMap = projectMap?.semanticMap || {};
  const nextActionPlan = result?.nextActionPlan || {};
  const architectureHealth = result?.architectureHealth || {};
  const aiAnalysis = result?.aiAnalysis || {};
  const findings = asArray(architectureHealth?.findings);
  const steps = asArray(nextActionPlan?.suggestedNextSteps);

  const tokensSpent =
    aiAnalysis?.tokensSpent === true ||
    semanticMap?.tokensSpent === true ||
    nextActionPlan?.tokensSpent === true ||
    architectureHealth?.tokensSpent === true;

  const base = [
    "Перевірив СГ по репозиторію.",
    "",
    `Стан: ${architectureHealth?.status || "unknown"}`,
    `Оцінка архітектури: ${safeNumber(architectureHealth?.score)}/100`,
    `Файлів: ${result?.filesCount ?? "-"}`,
    `Модулів: ${result?.modulesCount ?? "-"}`,
    `Залежностей: ${result?.dependenciesCount ?? "-"}`,
    `Токени витрачені: ${boolText(tokensSpent)}`,
  ];

  if (mode === "next_action_plan") {
    return [
      ...base,
      "",
      "Найкращі наступні кроки:",
      buildNextStepsText(steps, 4),
      "",
      "Важливо: pillars не чіпати, real AI не запускати без дозволу.",
    ].join("\n");
  }

  if (mode === "architecture_health") {
    return [
      ...base,
      "",
      `Ризики: high=${countBySeverity(findings, "high")}, medium=${countBySeverity(findings, "medium")}, critical=${countBySeverity(findings, "critical")}`,
      "",
      "Головні пункти:",
      buildTopFindingsText(findings, 5),
      "",
      "Висновок: це діагностика, не зміна коду.",
    ].join("\n");
  }

  return [
    ...base,
    "",
    "Коротко:",
    buildTopFindingsText(findings, 3),
    "",
    "Далі:",
    buildNextStepsText(steps, 3),
  ].join("\n");
}

export async function maybeHandleProjectDiagnosticNaturalBridge({
  text,
  route,
  replyAndLog,
  isMonarchUser = false,
  isPrivateChat = false,
  transport = "unknown",
  chatId = null,
  globalUserId = null,
} = {}) {
  const diagnostic = classifyDiagnosticNeed({ text, route });

  if (!diagnostic.shouldHandle) {
    return {
      handled: false,
      reason: diagnostic.reason,
    };
  }

  if (!isMonarchUser || !isPrivateChat) {
    if (typeof replyAndLog === "function") {
      await replyAndLog(
        "Це внутрішня діагностика СГ. Вона доступна тільки Монарху в приватному/довіреному контексті.",
        {
          handler: "projectDiagnosticNaturalBridge",
          event: "project_diagnostic_access_denied",
          transport_agnostic: true,
          read_only: true,
          transport,
          chatId,
          globalUserId,
        }
      );
    }

    return {
      handled: true,
      reason: "project_diagnostic_access_denied",
    };
  }

  if (typeof replyAndLog === "function") {
    await replyAndLog("Прийняв. Технічно перевіряю стан СГ без витрати real AI токенів.", {
      handler: "projectDiagnosticNaturalBridge",
      event: "project_diagnostic_started",
      mode: diagnostic.mode,
      transport_agnostic: true,
      read_only: true,
      tokens_spent: false,
    });
  }

  const service = new RepoStateAgentService();
  const result = await service.run({
    forceAiAnalysis: false,
    allowRealAi: false,
  });

  const reply = buildHumanDiagnosticReply({
    result,
    mode: diagnostic.mode,
  });

  if (typeof replyAndLog === "function") {
    await replyAndLog(reply, {
      handler: "projectDiagnosticNaturalBridge",
      event: "project_diagnostic_completed",
      mode: diagnostic.mode,
      transport_agnostic: true,
      read_only: true,
      tokens_spent: false,
      architectureHealthStatus: result?.architectureHealth?.status || null,
      architectureHealthScore: result?.architectureHealth?.score ?? null,
      scanRunId: result?.persistence?.scanRunId || null,
    });
  }

  return {
    handled: true,
    reason: "project_diagnostic_completed",
    mode: diagnostic.mode,
    result,
  };
}

export default {
  maybeHandleProjectDiagnosticNaturalBridge,
};
