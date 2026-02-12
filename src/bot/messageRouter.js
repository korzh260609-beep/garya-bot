// ============================================================================
// === src/bot/messageRouter.js — MAIN HANDLER extracted from index.js ===
// ============================================================================

import { handleRepoReview2 } from "./handlers/repoReview2.js";
import { handleRepoSearch } from "./handlers/repoSearch.js";
import { handleRepoFile } from "./handlers/repoFile.js";
import { handleRepoTree } from "./handlers/repoTree.js";
import { handleRepoStatus } from "./handlers/repoStatus.js";
import { handleCodeFullfile } from "./handlers/codeFullfile.js";
import { handleCodeInsert } from "./handlers/codeInsert.js";
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

// ✅ Stage 5.3: workflow check
import { handleWorkflowCheck } from "./handlers/workflowCheck.js";

import { resolveUserAccess } from "../users/userAccess.js";
import pool from "../../db.js";

import { dispatchCommand } from "./commandDispatcher.js";

// === CORE ===
import { getAnswerMode, setAnswerMode } from "../../core/answerMode.js";
import { loadProjectContext } from "../../core/projectContext.js";
import { buildSystemPrompt } from "../../systemPrompt.js";

import {
  parseCommand,
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

// ============================================================================
// Stage 3.5: COMMAND RATE-LIMIT (in-memory, per instance)
// NOTE: multi-instance accuracy will be handled later via DB locks (Stage 2.8 / 6.8)
// Env overrides (optional):
// - CMD_RL_WINDOW_MS (default 20000)
// - CMD_RL_MAX (default 6)
// ============================================================================
const CMD_RL_WINDOW_MS = Math.max(
  1000,
  Number(process.env.CMD_RL_WINDOW_MS || 20000)
);
const CMD_RL_MAX = Math.max(1, Number(process.env.CMD_RL_MAX || 6));

const __cmdRateState = new Map(); // key -> [timestamps]

function checkCmdRateLimit(key) {
  const now = Date.now();
  const arr = __cmdRateState.get(key) || [];
  const fresh = arr.filter((t) => now - t < CMD_RL_WINDOW_MS);

  if (fresh.length >= CMD_RL_MAX) {
    const oldest = fresh[0];
    const retryAfterMs = Math.max(0, CMD_RL_WINDOW_MS - (now - oldest));
    __cmdRateState.set(key, fresh);
    return { allowed: false, retryAfterMs };
  }

  fresh.push(now);
  __cmdRateState.set(key, fresh);
  return { allowed: true, retryAfterMs: 0 };
}

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

      const chatType = msg.chat?.type || "unknown";
      const isPrivate = chatType === "private";
      const isMonarchUser = isMonarchFn(senderIdStr);

      // =========================
      // === ACCESS PACK (DB)
      // =========================
      const accessPack = await resolveUserAccess({
        chatIdStr,
        senderIdStr,
        isMonarch: isMonarchFn,
      });

      const userRole = accessPack?.userRole || "guest";
      const userPlan = accessPack?.userPlan || "free";
      const user =
        accessPack?.user || {
          role: userRole,
          plan: userPlan,
          bypassPermissions: false,
        };

      // bypass обязателен, т.к. ниже он используется в dispatch/handlers
      const bypass = Boolean(user?.bypassPermissions);

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

        // ======================================================================
        // === HARD DEV-GATE (ONLY MONARCH IN PRIVATE CHAT)
        // ======================================================================
        // Rule: ANY project/dev/system command is forbidden outside monarch DM.
        // In groups: silent block (per monarch rule).
        const DEV_COMMANDS = new Set([
          "/reindex",
          "/repo_get",
          "/repo_check",
          "/repo_review",
          "/repo_analyze",
          "/repo_diff",
          "/code_fullfile",
          "/code_insert",

          // Step 4: CODE_OUTPUT status flag (skeleton only)
          "/code_output_status",

          // ✅ Stage 5.3: workflow check
          "/workflow_check",

          "/pm_set",
          "/pm_show",

          "/tasks",
          "/start_task",
          "/stop_task",
          "/stop_all",
          "/run_task",
          "/run_task_cmd",
          "/new_task",
          "/demo_task",
          "/btc_test_task",

          "/sources",
          "/sources_diag",
          "/source",
          "/diag_source",
          "/test_source",

          "/approve",
          "/deny",
          "/file_logs",
          "/ar_list",
        ]);

        const isDev = DEV_COMMANDS.has(cmd);

        if (isDev && (!isMonarchUser || !isPrivate)) {
          // Silent block (no replies, no leakage)
          return;
        }
        // ======================================================================

        // FORCE /reindex to bypass CMD_ACTION routing (monarch DM only)
        if (cmd === "/reindex") {
          await handleReindexRepo({ bot, chatId });
          return;
        }

        // command router (some legacy commands are mapped)
        const action = CMD_ACTION[cmd];
        if (action) {
          // Stage 3.3: permissions-layer enforcement (can() + access request flow)
          const allowed = await requirePermOrReply(cmd, { rest });
          if (!allowed) return;

          // Stage 3.5: rate-limit commands (skip for monarch/bypass)
          if (!isMonarchUser && !bypass) {
            const key = `${senderIdStr}:${chatIdStr}:cmd`;
            const rl = checkCmdRateLimit(key);
            if (!rl.allowed) {
              const sec = Math.ceil(rl.retryAfterMs / 1000);
              await bot.sendMessage(chatId, `⏳ Слишком часто. Подожди ${sec} сек.`);
              return;
            }
          }

          // ✅ FIX: dispatchCommand must receive (cmd, ctx)
          // Previously it was called with a single object, which made ctx undefined inside dispatcher.
          const ctx = {
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
          };

          await dispatchCommand(cmd, ctx);
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

          // Step 4: status-only flag (NO enable logic, NO code generation)
          case "/code_output_status": {
            await bot.sendMessage(
              chatId,
              "CODE_OUTPUT: DISABLED (skeleton only)\nReason: governance gate — code generation запрещена до отдельного решения в DECISIONS.md"
            );
            return;
          }

          // ✅ Stage 5.3: workflow check (skeleton handler)
          case "/workflow_check": {
            await handleWorkflowCheck({ bot, chatId, rest });
            return;
          }

          case "/repo_status": {
            await handleRepoStatus({ bot, chatId });
            return;
          }

          case "/repo_tree": {
            await handleRepoTree({ bot, chatId, rest });
            return;
          }

          case "/repo_file": {
            await handleRepoFile({ bot, chatId, rest });
            return;
          }

          case "/repo_review2": {
            await handleRepoReview2({ bot, chatId });
            return;
          }

          case "/repo_search": {
            await handleRepoSearch({ bot, chatId, rest });
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

          case "/code_fullfile": {
            // IMPORTANT: handler needs callAI
            // STAGE 4.2: also pass senderIdStr for refusal logging (no DB)
            await handleCodeFullfile({ bot, chatId, rest, callAI, senderIdStr });
            return;
          }

          case "/code_insert": {
            // IMPORTANT: handler needs callAI
            // STAGE 4.2: also pass senderIdStr for refusal logging (no DB)
            await handleCodeInsert({ bot, chatId, rest, callAI, senderIdStr });
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
