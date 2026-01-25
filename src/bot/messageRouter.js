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
  callWithFallback,
  isOwnerTaskRow,
  canStopTaskV1,
  sanitizeNonMonarchReply,
} from "../../core/helpers.js";

// === MEMORY ===
import { getChatHistory, saveMessageToMemory, saveChatPair } from "../memory/chatMemory.js";

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
import { getCoinGeckoSimplePriceById, getCoinGeckoSimplePriceMulti } from "../sources/coingecko/index.js";

// === FILE-INTAKE / MEDIA ===
import * as FileIntake from "../media/fileIntake.js";

// === LOGGING (interaction_logs) ===
import { logInteraction } from "../logging/interactionLogs.js";

// ============================================================================
// === ATTACH ROUTER
// ============================================================================

export function attachMessageRouter({
  bot,
  callAI,
  upsertProjectSection,

  // limits
  MAX_HISTORY_MESSAGES = 20,
}) {
  bot.on("message", async (msg) => {
    try {
      const chatId = msg.chat?.id;
      if (!chatId) return;

      const chatIdStr = String(chatId);
      const senderIdStr = String(msg.from?.id || "");
      const text = String(msg.text || "");
      const trimmed = text.trim();

      // =========================
      // === ACCESS / ROLE
      // =========================

      // ВАЖНО: монарх определяется по USER_ID (msg.from.id), а не по chat_id
      const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "");

      // Backward-compat для permGuard (там ожидается имя MONARCH_CHAT_ID)
      const MONARCH_CHAT_ID = MONARCH_USER_ID;

      const isMonarchFn = (idStr) => String(idStr || "") === MONARCH_USER_ID;

      const accessPack = await resolveUserAccess({
        chatIdStr,
        senderIdStr,
        isMonarch: isMonarchFn,
      });

      const userRole = accessPack?.userRole || "guest";
      const userPlan = accessPack?.userPlan || "free";
      const user =
        accessPack?.user || { role: userRole, plan: userPlan, bypassPermissions: false };

      // bypass обязателен, т.к. ниже он используется в dispatch/handlers
      const bypass = Boolean(user?.bypassPermissions);

      const isMonarch = userRole === "monarch";

      // permission helper (reply-safe) — permGuard ТРЕБУЕТ msg
      const requirePermOrReply = buildRequirePermOrReply({
        bot,
        msg,
        MONARCH_CHAT_ID,
        user,
        userRole,
        userPlan,
        trimmed,
        CMD_ACTION,
      });

      // =========================
      // === COMMANDS
      // =========================
      if (trimmed.startsWith("/")) {
        const { cmd, rest } = parseCommand(trimmed);

        // command router (some legacy commands are mapped)
        const action = CMD_ACTION[cmd];
        if (action) {
          await dispatchCommand({
            action,
            bot,
            msg,
            chatId,
            chatIdStr,
            senderIdStr,
            rest,
            bypass,
            requirePermOrReply,

            // deps
            pool,
            callAI,
            logInteraction,

            // tasks
            createDemoTask,
            createManualTask,
            createTestPriceMonitorTask,
            getUserTasks,
            getTaskById,
            runTaskWithAI,
            updateTaskStatus,

            // sources
            runSourceDiagnosticsOnce,
            getAllSourcesSafe,
            fetchFromSourceKey,
            formatSourcesList,
            diagnoseSource,
            testSource,

            // answer mode
            getAnswerMode,
            setAnswerMode,
          });
          return;
        }

        // inline switch (kept for backward compatibility)
        switch (cmd) {
          case "/approve": {
            await handleApprove({ bot, chatId, rest, bypass });
            return;
          }

          case "/deny": {
            await handleDeny({ bot, chatId, rest, bypass });
            return;
          }

          case "/reindex": {
            await handleReindexRepo({ bot, chatId });
            return;
          }

          case "/repo_get": {
            await handleRepoGet({ bot, chatId, rest });
            return;
          }

          case "/repo_check": {
            await handleRepoCheck({ bot, chatId, rest });
            return;
          }

          case "/repo_analyze": {
            await handleRepoAnalyze({ bot, chatId, rest });
            return;
          }

          case "/repo_review": {
            await handleRepoReview({ bot, chatId, rest });
            return;
          }

          case "/repo_diff": {
            await handleRepoDiff({ bot, chatId, rest });
            return;
          }

          case "/ar_list": {
            await handleArList({ bot, chatId, rest, bypass });
            return;
          }

          case "/file_logs": {
            await handleFileLogs({ bot, chatId, chatIdStr, rest, bypass });
            return;
          }

          case "/demo_task": {
            await handleDemoTask({ bot, chatId, chatIdStr, createDemoTask });
            return;
          }

          case "/stop_all": {
            await handleStopAllTasks({ bot, chatId, chatIdStr, bypass, canStopTaskV1 });
            return;
          }

          case "/run_task_cmd": {
            await handleRunTaskCmd({ bot, chatId, chatIdStr, rest, bypass, isOwnerTaskRow });
            return;
          }

          case "/sources": {
            await handleSourcesList({
              bot,
              chatId,
              chatIdStr,
              bypass,
              getAllSourcesSafe,
              formatSourcesList,
            });
            return;
          }

          case "/sources_diag": {
            await handleSourcesDiag({
              bot,
              chatId,
              chatIdStr,
              rest,
              bypass,
              runSourceDiagnosticsOnce,
            });
            return;
          }

          case "/source": {
            await handleSource({ bot, chatId, chatIdStr, rest, bypass, fetchFromSourceKey });
            return;
          }

          case "/diag_source": {
            await handleDiagSource({ bot, chatId, chatIdStr, rest, bypass, diagnoseSource });
            return;
          }

          case "/test_source": {
            await handleTestSource({ bot, chatId, chatIdStr, rest, bypass, testSource });
            return;
          }

          case "/tasks": {
            await handleTasksList({ bot, chatId, chatIdStr, bypass, getUserTasks });
            return;
          }

          case "/start_task": {
            await handleStartTask({ bot, chatId, chatIdStr, rest, bypass, updateTaskStatus });
            return;
          }

          case "/stop_task": {
            await handleStopTask({
              bot,
              chatId,
              chatIdStr,
              rest,
              bypass,
              canStopTaskV1,
              updateTaskStatus,
            });
            return;
          }

          case "/run_task": {
            await handleRunTask({ bot, chatId, chatIdStr, rest, bypass, runTaskWithAI });
            return;
          }

          case "/new_task": {
            await handleNewTask({ bot, chatId, chatIdStr, rest, bypass, createManualTask });
            return;
          }

          case "/btc_test_task": {
            await handleBtcTestTask({
              bot,
              chatId,
              chatIdStr,
              rest,
              bypass,
              createTestPriceMonitorTask,
            });
            return;
          }

          case "/pm_show": {
            await handlePmShow({ bot, chatId, chatIdStr, rest, bypass });
            return;
          }

          case "/pm_set": {
            await handlePmSet({
              bot,
              chatId,
              chatIdStr,
              rest,
              bypass,
              upsertProjectSection,
            });
            return;
          }

          default: {
            // неизвестная команда — игнор (поведение без изменений)
            break;
          }
        } // end switch (cmd)

        return;
      } // end if (trimmed.startsWith("/"))

      // ======================================================================
      // === NOT COMMANDS: FILE-INTAKE + MEMORY + CONTEXT + AI ===
      // ======================================================================

      await handleChatMessage({
        bot,
        msg,
        chatId,
        chatIdStr,
        senderIdStr,
        trimmed,
        bypass,
        MAX_HISTORY_MESSAGES,

        FileIntake,

        saveMessageToMemory,
        getChatHistory,
        saveChatPair,

        logInteraction,

        loadProjectContext,
        getAnswerMode,
        buildSystemPrompt,

        // FIX: handleChatMessage ожидает функцию isMonarch(id), а не boolean
        isMonarch: isMonarchFn,

        callAI,
        sanitizeNonMonarchReply,
      });

      return;
    } catch (e) {
      // не спамим чат деталями; лог — в консоль
      console.error("messageRouter error:", e);
    }
  }); // ✅ end bot.on("message", ...)
} // ✅ end attachMessageRouter(...)
