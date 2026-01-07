// ============================================================================
// === src/bot/messageRouter.js — MAIN HANDLER extracted from index.js ===
// ============================================================================

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

import { approveAndNotify, denyAndNotify, listAccessRequests, createAccessRequest } from "../users/accessRequests.js";

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
import { ensureUserProfile } from "../users/userProfile.js";
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

async function getTaskRowById(id) {
  const res = await pool.query(`SELECT * FROM tasks WHERE id = $1 LIMIT 1`, [
    Number(id),
  ]);
  return res.rows?.[0] || null;
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------
export function attachMessageRouter({
  bot,
  MONARCH_CHAT_ID,
  DEFAULT_PLAN = "free",
  MAX_HISTORY_MESSAGES = 20,
}) {
  function isMonarch(chatIdStr) {
    return String(chatIdStr) === String(MONARCH_CHAT_ID);
  }

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const chatIdStr = chatId.toString();

    const senderId = msg.from?.id;
    const senderIdStr = senderId?.toString() || "";

    const text = msg.text || "";
    const trimmed = text.trim();

    // 0) User profile
    await ensureUserProfile(msg);

    const { userRole, userPlan, bypass, access, user } = await resolveUserAccess({
      chatIdStr,
      senderIdStr,
      DEFAULT_PLAN,
      isMonarch,
    });

    // ✅ mapping команд → action keys (единый контроль)
    const CMD_ACTION = {
      "/profile": "cmd.profile",
      "/me": "cmd.profile",
      "/whoami": "cmd.profile",

      "/mode": "cmd.mode",

      "/tasks": "cmd.tasks.list",
      "/run": "cmd.task.run",
      "/newtask": "cmd.task.create",

      "/price": "cmd.price",
      "/prices": "cmd.prices",

      "/sources": "cmd.sources.list",
      "/source": "cmd.source.fetch",
      "/diag_source": "cmd.source.diagnose",
      "/test_source": "cmd.source.test",

      "/stop_all_tasks": "cmd.admin.stop_all_tasks",
      "/start_task": "cmd.admin.start_task",
      "/stop_tasks_type": "cmd.admin.stop_tasks_type",
      "/users_stats": "cmd.admin.users_stats",
      "/file_logs": "cmd.admin.file_logs",
      "/pm_set": "cmd.admin.pm_set",

      "/ar_create_test": "cmd.admin.ar_create_test",
      "/ar_list": "cmd.admin.ar_list",
    };

    // ✅ Вынесено в src/bot/permGuard.js без изменения логики
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

    // ======================================================================
    // === COMMANDS ===
    // ======================================================================
    if (trimmed.startsWith("/")) {
      const parsed = parseCommand(trimmed);
      const cmd = parsed?.cmd || trimmed.split(" ")[0];
      const rest = parsed?.rest || "";

      if (!(await requirePermOrReply(cmd, { rest }))) return;

      // === COMMAND DISPATCHER (SKELETON) ===
      const dispatchResult = await dispatchCommand(cmd, {
        bot,
        msg,
        chatId,
        chatIdStr,
        senderIdStr,
        userRole,
        userPlan,
        bypass,
        access,
        user,
        rest,
        getCoinGeckoSimplePriceById,
        getCoinGeckoSimplePriceMulti,
        getAnswerMode,
        setAnswerMode,
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

        case "/ar_create_test": {
          await handleArCreateTest({
            bot,
            chatId,
            chatIdStr,
            userRole,
            bypass,
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

        case "/demo_task": {
          await handleDemoTask({
            bot,
            chatId,
            chatIdStr,
            createDemoTask,
          });
          return;
        }

        case "/btc_test_task": {
          await handleBtcTestTask({
            bot,
            chatId,
            chatIdStr,
            access,
            callWithFallback,
            createTestPriceMonitorTask,
          });
          return;
        }

        case "/newtask": {
          await handleNewTask({
            bot,
            chatId,
            chatIdStr,
            rest,
            access,
            callWithFallback,
            createManualTask,
          });
          return;
        }

        case "/run": {
          await handleRunTaskCmd({
            bot,
            chatId,
            chatIdStr,
            rest,
            access,
            callWithFallback,
            runTask: runTaskWithAI,
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

        case "/tasks": {
          await handleTasksList({
            bot,
            chatId,
            chatIdStr,
            getUserTasks,
            access,
          });
          return;
        }

        case "/stop_task": {
          await handleStopTask({
            bot,
            chatId,
            chatIdStr,
            rest,
            userRole,
            bypass,
            getTaskRowById,
            isOwnerTaskRow,
            canStopTaskV1,
            updateTaskStatus,
          });
          return;
        }

        case "/start_task": {
          await handleStartTask({
            bot,
            chatId,
            rest,
            bypass,
            updateTaskStatus,
          });
          return;
        }

case "/sources": {
  await handleSourcesList({
    bot,
    chatId,
    userRole,
    userPlan,
    bypass,
    getAllSourcesSafe,
  });
  return;
}

        case "/sources_diag": {
          await handleSourcesDiag({
            bot,
            chatId,
            userRole,
            userPlan,
            bypass,
            runSourceDiagnosticsOnce,
          });
          return;
        }

        case "/source": {
          await handleSource({
            bot,
            msg,
            chatId,
            chatIdStr,
            rest,
            access,
            userRole,
            userPlan,
            bypass,
          });
          return;
        }

        case "/diag_source": {
          await handleDiagSource({
            bot,
            chatId,
            rest,
            userRole,
            userPlan,
            bypass,
            runSourceDiagnosticsOnce,
          });
          return;
        }

        case "/test_source": {
          await handleTestSource({
            bot,
            chatId,
            rest,
            fetchFromSourceKey,
            userRole,
            userPlan,
            bypass,
          });
          return;
        }

        case "/pm_show": {
          await handlePmShow({
            bot,
            chatId,
            rest,
            getProjectSection,
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
      isMonarch,

      callAI,
      sanitizeNonMonarchReply,
    });

    return;
  }); // ✅ end bot.on("message", ...)

} // ✅ end attachMessageRouter(...)
