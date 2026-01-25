// ============================================================================
// === src/bot/messageRouter.js — MAIN HANDLER extracted from index.js ===
// ============================================================================

import { handleRepoReview } from "./handlers/repoReview.js";

import { handleRepoDiff } from "./handlers/repoDiff.js";

import { handleRepoCheck } from "./handlers/repoCheck.js";

import { handleRepoAnalyze } from "./handlers/repoAnalyze.js";

import { handleRepoGet } from "./handlers/repoGet.js";

import { handleReindexRepo } from "./handlers/reindexRepo.js";

import { CMD_ACTION } from "./cmdActionMap.js";

import { handleRunTaskCmd } from "./handlers/runTaskCmd.js";

import { handleChatMessage } from "./handlers/chat.js";

import { handlePmSet } from "./handlers/pmSet.js";

import { handlePmShow } from "./handlers/pmShow.js";

import { handleTestSource } from "./handlers/testSource.js";

import { handleDiagSource } from "./handlers/diagSource.js";

import { handleSourcesList } from "./handlers/sourcesList.js";

import { handleTasksList } from "./handlers/tasksList.js";

import { handleStartTask } from "./handlers/startTask.js";

import { handleStopTask } from "./handlers/stopTask.js";

import { handleSourcesDiag } from "./handlers/sources_diag.js";

import { handleSource } from "./handlers/source.js";

import { handleRunTask } from "./handlers/runTask.js";

import { handleNewTask } from "./handlers/newTask.js";

import { handleBtcTestTask } from "./handlers/btcTestTask.js";

import { handleDemoTask } from "./handlers/demoTask.js";

import { handleStopAllTasks } from "./handlers/stopAllTasks.js";

import { handleFileLogs } from "./handlers/fileLogs.js";

import { handleArList } from "./handlers/arList.js";

import { handleDeny } from "./handlers/deny.js";

import { handleApprove } from "./handlers/approve.js";

import { resolveUserAccess } from "../users/userAccess.js";

import pool from "../../db.js";

import { dispatchCommand } from "./commandDispatcher.js";

// === CORE ===
import { getAnswerMode, setAnswerMode } from "../../core/answerMode.js";
import { loadProjectContext } from "../../core/projectContext.js";
import { buildSystemPrompt } from "../../systemPrompt.js";

import {
  parseCommand,
  firstWordAndRest,
  callWithFallback,
  isOwnerTaskRow,
  canStopTaskV1,
  sanitizeNonMonarchReply,
} from "../../core/helpers.js";

// === MEMORY ===
import {
  getChatHistory,
  saveMessageToMemory,
  saveChatPair,
} from "../memory/chatMemory.js";

// === USERS ===
import { buildRequirePermOrReply } from "./permGuard.js";

// === TASK ENGINE ===
import {
  createDemoTask,
  createManualTask,
  createTestPriceMonitorTask,
  getUserTasks,
  getTaskById,
  runTaskWithAI,
  updateTaskStatus,
} from "../tasks/taskEngine.js";

// === SOURCES LAYER ===
import {
  runSourceDiagnosticsOnce,
  getAllSourcesSafe,
  fetchFromSourceKey,
  formatSourcesList,
  diagnoseSource,
  testSource,
} from "../sources/sources.js";

// === COINGECKO (V1 SIMPLE PRICE) ===
import {
  getCoinGeckoSimplePriceById,
  getCoinGeckoSimplePriceMulti,
} from "../sources/coingecko/index.js";

// === FILE-INTAKE / MEDIA ===
import * as FileIntake from "../media/fileIntake.js";

// === LOGGING (interaction_logs) ===
import { logInteraction } from "../logging/interactionLogs.js";

// === AI ===
import { callAI } from "../../ai.js";

// === PROJECT MEMORY ===
import { getProjectSection, upsertProjectSection } from "../../projectMemory.js";

// ----------------------------------------------------------------------------
// Fallback helpers (чтобы не падать из-за отсутствующих импортов)
// ----------------------------------------------------------------------------
async function getRecentFileIntakeLogs(chatIdStr, n = 10) {
  const limit = Math.max(1, Math.min(Number(n) || 10, 30));
  const res = await pool.query(
    `
    SELECT *
    FROM file_intake_logs
    WHERE chat_id = $1
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [chatIdStr, limit]
  );
  return res.rows || [];
}

async function getOrCreateUserRow(chatIdStr) {
  try {
    const res = await pool.query("SELECT * FROM users WHERE chat_id = $1", [
      chatIdStr,
    ]);
    if (res.rows?.[0]) return res.rows[0];

    await pool.query(
      "INSERT INTO users (chat_id, role, plan) VALUES ($1, $2, $3)",
      [chatIdStr, "guest", "free"]
    );
    const res2 = await pool.query("SELECT * FROM users WHERE chat_id = $1", [
      chatIdStr,
    ]);
    return res2.rows?.[0] || null;
  } catch (e) {
    console.error("❌ getOrCreateUserRow error:", e);
    return null;
  }
}

// ============================================================================
// MAIN ROUTER
// ============================================================================
export async function handleMessage(bot, msg) {
  const chatId = msg.chat?.id;
  const chatIdStr = String(chatId);
  const senderIdStr = String(msg.from?.id || "");

  const text = String(msg.text || "").trim();
  if (!text) return;

  const { firstWord, rest } = firstWordAndRest(text);
  const cmd = parseCommand(firstWord);

  // --- Access / roles ---
  const access = await resolveUserAccess({ pool, chatIdStr, senderIdStr });
  const userRole = access?.role || "guest";
  const userPlan = access?.plan || "free";
  const bypass = Boolean(access?.bypass);

  // --- Permissions helper ---
  const requirePermOrReply = buildRequirePermOrReply({
    pool,
    bot,
    chatId,
    chatIdStr,
    userRole,
    bypass,
  });

  // --- Project context (pillars + system prompt) ---
  const projectContext = await loadProjectContext({
    getProjectSection,
    projectKey: "sg",
  });

  const systemPrompt = buildSystemPrompt({
    projectContext,
    answerMode: await getAnswerMode({ pool, chatIdStr }),
  });

  // --- Dispatch legacy + generic ---
  const dispatchResult = await dispatchCommand(cmd, {
    bot,
    chatId,
    chatIdStr,
    senderIdStr,
    userRole,
    userPlan,
    bypass,
    access,
    user: await getOrCreateUserRow(chatIdStr),
    rest,
    getCoinGeckoSimplePriceById,
    getCoinGeckoSimplePriceMulti,
    getAnswerMode: async () => getAnswerMode({ pool, chatIdStr }),
    setAnswerMode: async (mode) => setAnswerMode({ pool, chatIdStr, mode }),
    handleHelpLegacy: async () => {
      await bot.sendMessage(chatId, "Используй /help (legacy).");
    },
    requirePermOrReply,
    DEFAULT_PLAN,
    MONARCH_CHAT_ID,
  });

  if (dispatchResult?.handled) {
    return;
  }

  switch (cmd) {
    case "/approve": {
      await handleApprove({
        bot,
        chatId,
        chatIdStr,
        rest,
        bypass,
      });
      return;
    }

    case "/deny": {
      await handleDeny({
        bot,
        chatId,
        chatIdStr,
        rest,
        bypass,
      });
      return;
    }

    case "/pm_set": {
      await handlePmSet({
        bot,
        chatId,
        chatIdStr,
        rest,
        bypass,
      });
      return;
    }

    case "/pm_show": {
      await handlePmShow({
        bot,
        chatId,
        chatIdStr,
        bypass,
      });
      return;
    }

    case "/test_source": {
      await handleTestSource({
        bot,
        chatId,
        rest,
        bypass,
      });
      return;
    }

    case "/diag_source": {
      await handleDiagSource({
        bot,
        chatId,
        rest,
        bypass,
      });
      return;
    }

    case "/sources_list": {
      await handleSourcesList({
        bot,
        chatId,
        bypass,
      });
      return;
    }

    case "/sources_diag": {
      await handleSourcesDiag({
        bot,
        chatId,
        rest,
        bypass,
      });
      return;
    }

    case "/source": {
      await handleSource({
        bot,
        chatId,
        rest,
        bypass,
      });
      return;
    }

    case "/tasks_list": {
      await handleTasksList({
        bot,
        chatId,
        chatIdStr,
        bypass,
      });
      return;
    }

    case "/start_task": {
      await handleStartTask({
        bot,
        chatId,
        rest,
        bypass,
      });
      return;
    }

    case "/stop_task": {
      await handleStopTask({
        bot,
        chatId,
        rest,
        bypass,
      });
      return;
    }

    case "/stop_all_tasks": {
      await handleStopAllTasks({
        bot,
        chatId,
        bypass,
      });
      return;
    }

    case "/run_task": {
      await handleRunTask({
        bot,
        chatId,
        rest,
        bypass,
      });
      return;
    }

    case "/new_task": {
      await handleNewTask({
        bot,
        chatId,
        rest,
        bypass,
      });
      return;
    }

    case "/btc_test_task": {
      await handleBtcTestTask({
        bot,
        chatId,
        bypass,
      });
      return;
    }

    case "/demo_task": {
      await handleDemoTask({
        bot,
        chatId,
        bypass,
      });
      return;
    }

    case "/run_task_cmd": {
      await handleRunTaskCmd({
        bot,
        chatId,
        rest,
        bypass,
      });
      return;
    }

    case "/reindex": {
      await handleReindexRepo({
        bot,
        chatId,
      });
      return;
    }

    case "/repo_get": {
      await handleRepoGet({
        bot,
        chatId,
        rest,
      });
      return;
    }

    case "/repo_check": {
      await handleRepoCheck({
        bot,
        chatId,
        rest,
      });
      return;
    }

    case "/repo_analyze": {
      await handleRepoAnalyze({
        bot,
        chatId,
        rest,
      });
      return;
    }

    case "/repo_review": {
      await handleRepoReview({
        bot,
        chatId,
        rest,
      });
      return;
    }

    case "/repo_diff": {
      await handleRepoDiff({
        bot,
        chatId,
        rest,
      });
      return;
    }

    case "/ar_list": {
      await handleArList({
        bot,
        chatId,
        rest,
        bypass,
      });
      return;
    }

    case "/file_logs": {
      await handleFileLogs({
        bot,
        chatId,
        chatIdStr,
        rest,
        bypass,
      });
      return;
    }

    default:
      break;
  }

  // Fallback: normal chat message
  await handleChatMessage({
    bot,
    msg,
    chatId,
    chatIdStr,
    userRole,
    userPlan,
    bypass,
    systemPrompt,
    callAI,
    getChatHistory,
    saveMessageToMemory,
    saveChatPair,
    logInteraction,
    sanitizeNonMonarchReply,
    FileIntake,
    getRecentFileIntakeLogs,
    runSourceDiagnosticsOnce,
    getAllSourcesSafe,
    fetchFromSourceKey,
    formatSourcesList,
    diagnoseSource,
    testSource,
    createDemoTask,
    createManualTask,
    createTestPriceMonitorTask,
    getUserTasks,
    getTaskById,
    runTaskWithAI,
    updateTaskStatus,
    pool,
  });
}

// NOTE: keep these constants in this file (legacy compatibility)
const DEFAULT_PLAN = "free";
const MONARCH_CHAT_ID = "677128443";
