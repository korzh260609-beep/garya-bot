// src/core/projectIntent/modes/human/projectIntentHumanResponseBuilder.js
// ============================================================================
// HUMAN MODE RESPONSE BUILDER
//
// Purpose:
// - build concise human-readable responses from structured RepoStateAgent facts.
// - keep response choice tied to structured capability, not old Technical Mode templates.
// - avoid exposing debug protocol unless explicitly requested elsewhere.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";
import { HUMAN_PROJECT_CAPABILITIES } from "./projectIntentHumanCapabilitySelector.js";

function readRepoLabel(repoFacts = {}) {
  const repo = repoFacts?.facts?.repo || {};
  const fullName = repo.fullName || "unknown repo";
  const branch = repo.branch || "unknown branch";

  return `${fullName} / ${branch}`;
}

function readTotals(repoFacts = {}) {
  const totals = repoFacts?.facts?.totals || {};

  return {
    files: Number.isFinite(totals.files) ? totals.files : 0,
    modules: Number.isFinite(totals.modules) ? totals.modules : 0,
    dependencies: Number.isFinite(totals.dependencies) ? totals.dependencies : 0,
  };
}

function readArchitectureHealth(repoFacts = {}) {
  return repoFacts?.facts?.architectureHealth || {};
}

function readNextActionPlan(repoFacts = {}) {
  return repoFacts?.facts?.nextActionPlan || {};
}

function readRisks(repoFacts = {}) {
  const health = readArchitectureHealth(repoFacts);
  const risks = health?.risks || health?.riskHints || health?.topRisks || [];
  return Array.isArray(risks) ? risks.slice(0, 4) : [];
}

function formatRiskLine(risk) {
  if (typeof risk === "string") return `- ${risk}`;
  const title = risk?.title || risk?.risk || risk?.message || risk?.summary || "Risk item";
  const severity = risk?.severity ? ` (${risk.severity})` : "";
  return `- ${title}${severity}`;
}

function buildTotalsLine(totals) {
  return `Файлы: ${totals.files}. Модули: ${totals.modules}. Зависимости: ${totals.dependencies}.`;
}

function buildRepoStateResponse({ repoFacts }) {
  const repoLabel = readRepoLabel(repoFacts);
  const totals = readTotals(repoFacts);
  const health = readArchitectureHealth(repoFacts);
  const status = health?.status || "не определён";
  const score = Number.isFinite(health?.score) ? `${health.score}/100` : "нет оценки";

  return [
    `Проверил репозиторий через RepoStateAgent: ${repoLabel}.`,
    "",
    `Состояние: ${status}. Оценка архитектуры: ${score}.`,
    buildTotalsLine(totals),
    "Токены real AI: не тратились.",
  ].join("\n");
}

function buildArchitectureResponse({ repoFacts }) {
  const repoLabel = readRepoLabel(repoFacts);
  const totals = readTotals(repoFacts);
  const health = readArchitectureHealth(repoFacts);
  const summary = health?.summary || "Архитектурная сводка есть только на уровне RepoStateAgent facts; детальный AI-анализ не запускался.";
  const status = health?.status || "не определён";
  const score = Number.isFinite(health?.score) ? `${health.score}/100` : "нет оценки";

  return [
    `Архитектура проекта ${repoLabel}:`,
    "",
    summary,
    "",
    `Статус: ${status}. Оценка: ${score}.`,
    buildTotalsLine(totals),
    "",
    "Ключевой принцип: SG остаётся глобальной сущностью проекта; Telegram, Human Mode, RepoStateAgent и другие части — только компоненты/инструменты SG.",
  ].join("\n");
}

function buildRiskResponse({ repoFacts }) {
  const repoLabel = readRepoLabel(repoFacts);
  const health = readArchitectureHealth(repoFacts);
  const risks = readRisks(repoFacts);
  const status = health?.status || "не определён";

  const lines = [
    `Риски по ${repoLabel}:`,
    "",
    `Общий статус: ${status}.`,
  ];

  if (risks.length) {
    lines.push("Главные риски:");
    lines.push(...risks.map(formatRiskLine));
  } else {
    lines.push("Детальный список рисков не найден в текущих RepoStateAgent facts.");
  }

  lines.push("");
  lines.push("Правило безопасности: не менять pillars/runtime без явной команды и snapshot перед опасным шагом.");

  return lines.join("\n");
}

function buildNextStepResponse({ repoFacts }) {
  const repoLabel = readRepoLabel(repoFacts);
  const plan = readNextActionPlan(repoFacts);
  const summary = plan?.summary || "Следующий шаг не выделен явно в facts.";
  const actions = Array.isArray(plan?.actions) ? plan.actions.slice(0, 4) : [];

  const lines = [
    `Следующий безопасный шаг для ${repoLabel}:`,
    "",
    summary,
  ];

  if (actions.length) {
    lines.push("");
    lines.push("Действия:");
    lines.push(...actions.map((a) => `- ${typeof a === "string" ? a : a?.title || a?.summary || "Action"}`));
  }

  lines.push("");
  lines.push("Порядок остаётся прежним: skeleton → config → logic.");

  return lines.join("\n");
}

function buildModuleResponse({ repoFacts }) {
  const repoLabel = readRepoLabel(repoFacts);
  const totals = readTotals(repoFacts);

  return [
    `Модули проекта ${repoLabel} найдены через RepoStateAgent.`,
    "",
    `Всего модулей: ${totals.modules}.`,
    "Для точного разбора нужно указать область: memory, sources, transport, Human Mode, RepoStateAgent, projectIntent или другую часть.",
  ].join("\n");
}

function buildClarificationResponse() {
  return "Уточни область проекта: архитектура, риски, следующий шаг, модуль или общее состояние репозитория.";
}

function buildResponseTextForCapability({ capability, repoFacts }) {
  switch (capability) {
    case HUMAN_PROJECT_CAPABILITIES.ANSWER_FROM_REPO_STATE:
      return buildRepoStateResponse({ repoFacts });

    case HUMAN_PROJECT_CAPABILITIES.SUMMARIZE_ARCHITECTURE:
      return buildArchitectureResponse({ repoFacts });

    case HUMAN_PROJECT_CAPABILITIES.IDENTIFY_RISK:
      return buildRiskResponse({ repoFacts });

    case HUMAN_PROJECT_CAPABILITIES.SUGGEST_NEXT_STEP:
      return buildNextStepResponse({ repoFacts });

    case HUMAN_PROJECT_CAPABILITIES.EXPLAIN_MODULE:
      return buildModuleResponse({ repoFacts });

    case HUMAN_PROJECT_CAPABILITIES.ASK_CLARIFICATION:
      return buildClarificationResponse();

    case HUMAN_PROJECT_CAPABILITIES.NONE:
    default:
      return "Human Mode capability is not ready to build a project response.";
  }
}

export function buildHumanProjectIntentResponse({ repoFacts, capability } = {}) {
  if (repoFacts?.ok !== true) {
    return {
      mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
      ok: false,
      text: "Human Mode needs RepoStateAgent facts before building a project response.",
      reason: "repo_facts_required_before_response",
    };
  }

  if (capability?.ready !== true) {
    return {
      mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
      ok: false,
      text: "Human Mode capability is not ready yet.",
      reason: "capability_required_before_response",
    };
  }

  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    ok: true,
    text: buildResponseTextForCapability({
      capability: capability.capability,
      repoFacts,
    }),
    reason: "human_response_built_from_repo_facts_and_capability",
  };
}

export default {
  buildHumanProjectIntentResponse,
};
