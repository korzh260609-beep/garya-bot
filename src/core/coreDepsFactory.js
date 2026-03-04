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

    getCoinGeckoSimplePriceById,
    getCoinGeckoSimplePriceMulti,

    getUserTasks,
    getTaskById,
    runTaskWithAI,
    updateTaskStatus,
    createDemoTask,
    createManualTask,
    createTestPriceMonitorTask,

    MAX_HISTORY_MESSAGES,
  };
}

export default buildCoreDeps;
