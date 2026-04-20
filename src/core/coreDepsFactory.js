// src/core/coreDepsFactory.js
// STAGE 6.9.2 — Core deps factory (keep transport THIN)

import { dispatchCommand } from "../bot/commandDispatcher.js";
import { handleChatMessage } from "../bot/handlers/chat.js";
import { getChatHistory } from "../bot/memory/memoryBridge.js";

import { getAnswerMode, setAnswerMode } from "../../core/answerMode.js";
import { loadProjectContext } from "../../core/projectContext.js";
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

// ✅ STAGE 7A — Project Memory wiring for enforced pipeline
import {
  getProjectSection,
  getProjectMemoryList,
  upsertProjectSection,
  recordProjectWorkSession,
  updateProjectWorkSession,
} from "../../projectMemory.js";

// ✅ SOURCES — required for enforced command path
import {
  runSourceDiagnosticsOnce,
  getAllSourcesSafe,
  fetchFromSourceKey,
  formatSourcesList,
  diagnoseSource,
  testSource,
} from "../sources/sources.js";

import { envStr } from "../core/config.js";

export function buildCoreDeps({ bot, callAI, reply, MAX_HISTORY_MESSAGES = 20 } = {}) {
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
    buildSystemPrompt,

    logInteraction,
    sanitizeNonMonarchReply,

    FileIntake,

    // ✅ CRITICAL FIX — make Telegram file download token available
    // for enforced transport/core path -> chat.js -> fileIntakeDecision.js
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

    // ✅ STAGE 7A — make Project Memory commands available in enforced path
    getProjectSection,
    getProjectMemoryList,
    upsertProjectSection,
    recordProjectWorkSession,
    updateProjectWorkSession,

    // ✅ SOURCES — make source commands available in enforced path
    runSourceDiagnosticsOnce,
    getAllSourcesSafe,
    fetchFromSourceKey,
    formatSourcesList,
    diagnoseSource,
    testSource,

    MAX_HISTORY_MESSAGES,
  };
}

export default buildCoreDeps;