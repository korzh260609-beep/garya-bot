// src/core/coreDepsFactory.js
// STAGE 6.9.2 — Core deps factory (keep transport THIN)

import { dispatchCommand } from "../bot/commandDispatcher.js";
import { handleChatMessage } from "../bot/handlers/chat.js";
import { getChatHistory } from "../bot/memory/memoryBridge.js";

import { getAnswerMode, setAnswerMode } from "../../core/answerMode.js";
import { loadProjectContext } from "../../core/projectContext.js";
import { resolveProjectContextScope } from "../../core/projectContextScope.js";
import { buildSystemPrompt } from "../../systemPrompt.js";
import { logInteraction } from "../logging/interactionLogs.js";
import { sanitizeNonMonarchReply } from "../../core/helpers.js";

import * as FileIntake from "../media/fileIntake.js";

import {
  getCoinGeckoSimplePriceById,
  getCoinGeckoSimplePriceMulti,
} from "../sources/coingecko/index.js";

import {
  createDemoTask,
  createManualTask,
  createTestPriceMonitorTask,
  getUserTasks,
  getTaskById,
  runTaskWithAI,
  updateTaskStatus,
} from "../tasks/taskEngine.js";

import {
  getProjectSection,
  getProjectMemoryList,
  upsertProjectSection,
  recordProjectWorkSession,
  updateProjectWorkSession,
  upsertConfirmedProjectSectionState,
  appendConfirmedProjectDecision,
  appendConfirmedProjectConstraint,
  appendConfirmedProjectNextStep,
  writeConfirmedProjectMemory,
  listConfirmedProjectMemoryEntries,
  getLatestConfirmedProjectMemoryEntry,
  buildConfirmedProjectMemoryDigest,
  buildConfirmedProjectMemoryContext,
  updateConfirmedProjectMemoryEntry,
} from "../../projectMemory.js";

import {
  runSourceDiagnosticsOnce,
  getAllSourcesSafe,
  fetchFromSourceKey,
  formatSourcesList,
  diagnoseSource,
  testSource,
} from "../sources/sources.js";

import { ProjectEvidenceSeedService } from "../projectExperience/ProjectEvidenceSeedService.js";

import { envStr } from "../core/config.js";

async function fetchMockProjectEvidenceCommits({ repository, ref, limit } = {}) {
  return [
    {
      sha: "mock-project-evidence-seed",
      message: "Mock project evidence seed is wired for pipeline verification",
      repository: repository || "korzh260609-beep/garya-bot",
      ref: ref || "main",
      source: "mock_project_evidence_seed",
    },
  ].slice(0, Number.isFinite(Number(limit)) ? Number(limit) : 1);
}

async function fetchMockProjectEvidencePillars() {
  return {
    roadmap: "Mock ROADMAP evidence: Project Evidence Seed pipeline is being verified before real GitHub fetchers.",
    workflow: "Mock WORKFLOW evidence: trigger-policy -> seed -> light pack -> auto-capture dry-run.",
    decisions: "Mock DECISIONS evidence: no direct GitHub connector import, no DB writes, no pillar edits.",
  };
}

export function buildCoreDeps({ bot, callAI, reply, MAX_HISTORY_MESSAGES = 20 } = {}) {
  const projectEvidenceSeedService = new ProjectEvidenceSeedService({
    fetchRecentCommits: fetchMockProjectEvidenceCommits,
    fetchPillars: fetchMockProjectEvidencePillars,
  });

  return {
    reply,
    callAI,
    bot,

    dispatchCommand,
    handleChatMessage,
    getChatHistory,

    getAnswerMode,
    setAnswerMode,

    loadProjectContext,
    resolveProjectContextScope,
    buildSystemPrompt,

    logInteraction,
    sanitizeNonMonarchReply,

    FileIntake,

    telegramBotToken: envStr("TELEGRAM_BOT_TOKEN", ""),

    getCoinGeckoSimplePriceById,
    getCoinGeckoSimplePriceMulti,

    getUserTasks,
    getTaskById,
    runTaskWithAI,
    updateTaskStatus,
    createDemoTask,
    createManualTask,
    createTestPriceMonitorTask,

    getProjectSection,
    getProjectMemoryList,
    upsertProjectSection,
    recordProjectWorkSession,
    updateProjectWorkSession,

    upsertConfirmedProjectSectionState,
    appendConfirmedProjectDecision,
    appendConfirmedProjectConstraint,
    appendConfirmedProjectNextStep,
    writeConfirmedProjectMemory,

    listConfirmedProjectMemoryEntries,
    getLatestConfirmedProjectMemoryEntry,
    buildConfirmedProjectMemoryDigest,
    buildConfirmedProjectMemoryContext,
    updateConfirmedProjectMemoryEntry,

    runSourceDiagnosticsOnce,
    getAllSourcesSafe,
    fetchFromSourceKey,
    formatSourcesList,
    diagnoseSource,
    testSource,

    projectEvidenceSeedService,
    buildProjectEvidenceSeed: (input = {}) => projectEvidenceSeedService.buildSeed(input),

    MAX_HISTORY_MESSAGES,
  };
}

export default buildCoreDeps;
