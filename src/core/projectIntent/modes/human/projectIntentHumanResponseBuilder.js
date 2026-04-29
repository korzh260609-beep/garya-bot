// src/core/projectIntent/modes/human/projectIntentHumanResponseBuilder.js
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";
import { HUMAN_PROJECT_CAPABILITIES } from "./projectIntentHumanCapabilitySelector.js";

function buildSourcesResponse({ contextPack }) {
  return [
    "Для ответа по проекту я использую несколько источников:",
    "",
    "1. RepoStateAgent — текущие факты кода (что реально есть в репозитории).",
    "2. pillars/architecture — официальная архитектура проекта (как должно быть).",
    `3. projectMemory — ${contextPack?.projectMemory?.available ? "подключена" : "ещё не подключена"}.`,
    "4. userRules — правила работы и стиль взаимодействия.",
    "",
    "Важно: RepoStateAgent не равен SG. Это только источник фактов, а не принятие решений.",
  ].join("\n");
}

// ... (остальной код без изменений, вставлен ниже)

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

function readContextPackRepoFacts(contextPack = {}) {
  return contextPack?.repoFacts || {};
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

function formatAvailability(value) {
  return hasValue(value) ? "доступна" : "не найдена";
}

function readRisks(repoFacts = {}) {
  const health = readArchitectureHealth(repoFacts);
  const directRisks = health?.risks || health?.riskHints || health?.topRisks || [];
  if (Array.isArray(directRisks) && directRisks.length) return directRisks.slice(0, 4);
  if (Array.isArray(health?.findings) && health.findings.length) return health.findings.slice(0, 4);
  if (Array.isArray(health?.recommendedFocus) && health.recommendedFocus.length) return health.recommendedFocus.slice(0, 4);
  return [];
}

function formatRiskLine(risk) {
  if (typeof risk === "string") return `- ${risk}`;
  const title = risk?.title || risk?.risk || risk?.message || risk?.summary || "Risk item";
  const severity = risk?.severity || risk?.priority ? ` (${risk.severity || risk.priority})` : "";
  return `- ${title}${severity}`;
}

function buildTotalsLine(totals) {
  return `Файлы: ${totals.files}. Модули: ${totals.modules}. Зависимости: ${totals.dependencies}.`;
}

function buildResponseTextForCapability({ capability, repoFacts, contextPack }) {
  switch (capability) {
    case HUMAN_PROJECT_CAPABILITIES.EXPLAIN_SOURCES:
      return buildSourcesResponse({ contextPack });
    default:
      return "Human Mode capability is not ready to build a project response.";
  }
}

export function buildHumanProjectIntentResponse({ repoFacts, capability, contextPack } = {}) {
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
    text: buildResponseTextForCapability({ capability: capability.capability, repoFacts, contextPack }),
    reason: "human_response_built",
  };
}

export default {
  buildHumanProjectIntentResponse,
};
