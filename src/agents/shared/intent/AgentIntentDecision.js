// AGENT NOTE:
// SG 2.0 agent intent decision skeleton.
// Purpose: map live human messages to safe agent suggestions and action plans.
// This file is not a keyword-router, executor, runtime bridge, command handler, or technical mode.
// Do not execute agents, call runtime, Telegram, Render, GitHub, DB, AI, filesystem, network, or external services here.

import { getAgentConfigById, isAgentActionAllowed } from "../registry/AgentConfigRegistry.js";
import { getRegisteredAgentById } from "../registry/AgentRegistry.js";
import {
  AGENT_INTENT_SAFETY,
  AGENT_INTENT_TO_ACTION,
  AGENT_INTENT_TO_AGENT,
  AGENT_INTENT_TYPES,
} from "./AgentIntentTypes.js";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[!?.,:;()[\]{}"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase));
}

function decideIntentTypeFromText(text) {
  const normalized = normalizeText(text);

  if (!normalized) return AGENT_INTENT_TYPES.unknown;

  if (
    hasAny(normalized, [
      "по агентам",
      "агенты",
      "агентов",
      "карта агентов",
      "список агентов",
      "agent inventory",
      "agents inventory",
    ])
  ) {
    return AGENT_INTENT_TYPES.agentInventory;
  }

  if (
    hasAny(normalized, [
      "render",
      "рендер",
      "деплой",
      "deploy",
      "логи",
      "logs",
      "упал бот",
      "бот упал",
      "не отвечает бот",
    ])
  ) {
    if (hasAny(normalized, ["лог", "логи", "logs", "ошиб", "error", "trace"])) {
      return AGENT_INTENT_TYPES.renderLogs;
    }

    return AGENT_INTENT_TYPES.renderStatus;
  }

  if (
    hasAny(normalized, [
      "состояние repo",
      "состояние репо",
      "repo state",
      "репозиторий",
      "структура проекта",
      "карта проекта",
    ])
  ) {
    return AGENT_INTENT_TYPES.repoState;
  }

  if (
    hasAny(normalized, [
      "после изменений",
      "что изменилось",
      "проверить изменения",
      "maintenance",
      "регресс",
      "сломалось после",
    ])
  ) {
    return AGENT_INTENT_TYPES.repoMaintenance;
  }

  if (
    hasAny(normalized, [
      "что дальше",
      "следующий шаг",
      "дальше по проекту",
      "next step",
      "план действий",
    ])
  ) {
    return AGENT_INTENT_TYPES.projectNextStep;
  }

  if (hasAny(normalized, ["workspace", "рабочее пространство", "agent workspace", "команды workspace"])) {
    if (hasAny(normalized, ["запис", "создай", "write", "план записи"])) {
      return AGENT_INTENT_TYPES.workspaceWritePlan;
    }

    return AGENT_INTENT_TYPES.workspaceRead;
  }

  return AGENT_INTENT_TYPES.unknown;
}

export function buildAgentIntentDecision({ message = "", metadata = {} } = {}) {
  const intentType = decideIntentTypeFromText(message);
  const suggestedAgentId = AGENT_INTENT_TO_AGENT[intentType] || null;
  const suggestedAction = AGENT_INTENT_TO_ACTION[intentType] || null;
  const registeredAgent = suggestedAgentId ? getRegisteredAgentById(suggestedAgentId) : null;
  const agentConfig = suggestedAgentId ? getAgentConfigById(suggestedAgentId) : null;
  const actionAllowedByConfig = suggestedAgentId && suggestedAction ? isAgentActionAllowed(suggestedAgentId, suggestedAction) : false;

  return Object.freeze({
    intentType,
    suggestedAgentId,
    suggestedAction,
    confidence: intentType === AGENT_INTENT_TYPES.unknown ? "low" : "skeleton-rule",
    executionAllowed: false,
    requiresApproval: true,
    decisionOnly: true,
    canChangeState: false,
    tokensSpent: false,
    registeredAgentFound: Boolean(registeredAgent),
    agentConfigFound: Boolean(agentConfig),
    actionAllowedByConfig: Boolean(actionAllowedByConfig),
    plan: Object.freeze({
      step: "suggest_agent_only",
      executeAgent: false,
      executeApi: false,
      writeFiles: false,
      useAI: false,
      useDatabase: false,
      useRuntime: false,
    }),
    safety: Object.freeze({
      ...AGENT_INTENT_SAFETY,
    }),
    metadata: Object.freeze({
      ...metadata,
      mode: "agent_intent_decision_skeleton_v1",
      liveMessageSupported: true,
      deterministicSkeletonOnly: true,
      notKeywordRouter: true,
    }),
    warnings: Object.freeze([
      "AgentIntentDecision maps live messages to safe suggestions only. It does not execute agents.",
      "This is a deterministic skeleton, not the final semantic AI intent layer.",
    ]),
  });
}

export default {
  buildAgentIntentDecision,
};
