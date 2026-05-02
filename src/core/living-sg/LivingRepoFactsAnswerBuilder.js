// src/core/living-sg/LivingRepoFactsAnswerBuilder.js
// ============================================================================
// LIVING SG — Deterministic Repo Facts Answer Builder
//
// Purpose:
// - build repo facts answers directly from confirmed sourceResultEnvelope payload;
// - avoid AI-generated repository structure guesses;
// - keep source evidence separate from write/executor authority.
//
// Boundaries:
// - no source calls;
// - no repository reads;
// - no repository writes;
// - no executor;
// - no prompt routing;
// - no keyword/phrase/slash-command routing;
// - no AI call.
// ============================================================================

import {
  LIVING_SOURCE_RESULT_CONFIRMATION_STATUS,
} from "./LivingSourceResultEnvelope.js";

export const LIVING_REPO_FACTS_ANSWER_KIND = Object.freeze({
  REPO_STRUCTURE: "repo_structure",
  REPO_FILE_COUNT: "repo_file_count",
  REPO_FACTS_SUMMARY: "repo_facts_summary",
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.replace(/\s+/g, " ").slice(0, 240);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = "неизвестно") {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : fallback;
}

function takeList(value, limit = 8) {
  return safeArray(value).slice(0, limit);
}

function isConfirmedEnvelope(envelope = null) {
  return (
    isPlainObject(envelope) &&
    envelope.canClaimVerifiedFacts === true &&
    envelope?.confirmation?.status === LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.CONFIRMED
  );
}

function getProjectMap(envelope = null) {
  const payload = envelope?.payload;
  if (!isPlainObject(payload)) return null;
  if (isPlainObject(payload.projectMap)) return payload.projectMap;
  if (isPlainObject(payload.payload?.projectMap)) return payload.payload.projectMap;
  return null;
}

function normalizePathValue(value) {
  if (typeof value === "string") return safeText(value, "");
  if (isPlainObject(value)) {
    return safeText(value.path || value.rootPath || value.key || value.name, "");
  }
  return "";
}

function formatPathList(label, items = [], limit = 8) {
  const paths = takeList(items, limit)
    .map(normalizePathValue)
    .filter(Boolean);

  if (!paths.length) return [];
  return [`${label}: ${paths.join(", ")}`];
}

function formatLayers(projectMap = {}) {
  if (!isPlainObject(projectMap.layers)) return [];

  const layers = Object.entries(projectMap.layers)
    .filter(([, layer]) => isPlainObject(layer))
    .sort((a, b) => Number(b[1]?.filesCount || 0) - Number(a[1]?.filesCount || 0))
    .slice(0, 10);

  if (!layers.length) return [];

  return [
    "Слои / зоны:",
    ...layers.map(([name, layer]) => {
      const samples = takeList(layer.sampleFiles, 3)
        .map((item) => safeText(item, ""))
        .filter(Boolean);
      return `- ${safeText(name)}: ${safeNumber(layer.filesCount, "?")} файлов${samples.length ? `; примеры: ${samples.join(", ")}` : ""}`;
    }),
  ];
}

function formatModules(projectMap = {}) {
  const modules = takeList(projectMap.modules, 10).filter(isPlainObject);
  if (!modules.length) return [];

  return [
    "Модули:",
    ...modules.map((module) => {
      const key = safeText(module.key || module.name || module.rootPath);
      const root = safeText(module.rootPath);
      const count = safeNumber(module.filesCount, "?");
      const samples = takeList(module.sampleFiles, 3)
        .map((item) => safeText(item, ""))
        .filter(Boolean);
      return `- ${key}: root=${root}; ${count} файлов${samples.length ? `; примеры: ${samples.join(", ")}` : ""}`;
    }),
  ];
}

function getRequestedRepoFactsAnswerKind(input = {}) {
  const kind = safeText(input.repoFactsAnswerKind || input.answerKind, "");

  if (Object.values(LIVING_REPO_FACTS_ANSWER_KIND).includes(kind)) {
    return kind;
  }

  return "";
}

export function buildLivingRepoFactsAnswer(input = {}) {
  const envelope = input.sourceResultEnvelope || null;
  const livingSGPlan = input.livingSGPlan || null;
  const answerKind = getRequestedRepoFactsAnswerKind(input);

  if (livingSGPlan?.intentPlan?.intentKind !== "project_thinking") {
    return {
      handled: false,
      reason: "not_project_thinking",
    };
  }

  if (!answerKind) {
    return {
      handled: false,
      reason: "repo_facts_answer_kind_missing",
    };
  }

  if (!isConfirmedEnvelope(envelope)) {
    return {
      handled: false,
      reason: "source_result_envelope_not_confirmed",
    };
  }

  const projectMap = getProjectMap(envelope);
  if (!projectMap) {
    return {
      handled: false,
      reason: "project_map_missing",
    };
  }

  const repo = projectMap.repo || {};
  const totals = projectMap.totals || {};
  const layerLines = formatLayers(projectMap);
  const moduleLines = formatModules(projectMap);
  const entrypointLines = formatPathList("Entrypoints", projectMap.entrypoints, 8);
  const criticalLines = formatPathList("Critical files", projectMap.criticalFiles, 10);

  const includeStructure = answerKind !== LIVING_REPO_FACTS_ANSWER_KIND.REPO_FILE_COUNT;

  const lines = [
    `По подтверждённой projectMap репозитория ${safeText(repo.fullName)} на ветке ${safeText(repo.branch)}:`,
    `- файлов: ${safeNumber(totals.files)}`,
    `- модулей: ${safeNumber(totals.modules)}`,
    `- зависимостей: ${safeNumber(totals.dependencies)}`,
    `- структура полная: ${totals.structureComplete === true ? "да" : "нет/не подтверждено"}`,
    "",
    includeStructure ? layerLines : [],
    includeStructure && layerLines.length ? "" : null,
    includeStructure ? moduleLines : [],
    includeStructure && moduleLines.length ? "" : null,
    includeStructure ? entrypointLines : [],
    includeStructure ? criticalLines : [],
    "",
    "Я не добавляю типовые папки или файлы сверх этих verified-данных.",
  ].flat().filter((line) => line !== null && line !== undefined);

  return {
    handled: true,
    source: "LivingRepoFactsAnswerBuilder",
    reason: "deterministic_project_map_answer",
    answerKind,
    text: lines.join("\n"),
    metadata: {
      noAiCall: true,
      noSourceCall: true,
      noRepoRead: true,
      noRepoWrite: true,
      noExecutor: true,
      sourceEnvelopeConfirmed: true,
    },
  };
}

export default {
  LIVING_REPO_FACTS_ANSWER_KIND,
  buildLivingRepoFactsAnswer,
};
