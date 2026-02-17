// ============================================================================
// === src/bot/messageRouter.js — MAIN HANDLER extracted from index.js ===
// ============================================================================

import { getCodeOutputMode } from "../codeOutput/codeOutputMode.js";
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
import { ensureUserProfile } from "../users/userProfile.js"; // ✅ STAGE 4.2 WIRE
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

// ✅ Project Memory service (read)
import { getProjectSection } from "../../projectMemory.js";

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
      // === STAGE 4 (DEEP): CHAT CONTEXT NORMALIZATION
      // =========================
      const chatType = msg.chat?.type || "unknown"; // private | group | supergroup | channel | unknown
      const isPrivate = chatType === "private";

      // ======================================================================
      // STAGE 4 (DEEP): hard safety — if there is no sender identity, do nothing
      // (channels/service messages without msg.from)
      // ======================================================================
      if (!senderIdStr) return;

      // ✅ STAGE 4.2: ensure identity/profile on every incoming message WITH sender identity
      await ensureUserProfile(msg);

      // =========================
      // === ACCESS / ROLE
      // =========================

      // ВАЖНО: монарх определяется по USER_ID (msg.from.id), а не по chat_id
      const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "").trim();

      const isMonarchFn = (idStr) => String(idStr || "") === MONARCH_USER_ID;
      const isMonarchUser = isMonarchFn(senderIdStr);

      // =========================
      // === STAGE 4 (DEEP): unified identity context (single source of truth)
      // =========================
      const identityCtx = {
        transport: "telegram",
        senderIdStr, // user identity
        chatIdStr, // transport context only
        chatType,
        isPrivateChat: isPrivate,
        isMonarchUser,
        MONARCH_USER_ID,
      };

      // =========================
      // === ACCESS PACK (DB)
      // =========================
      const accessPack = await resolveUserAccess({
        senderIdStr,
        isMonarch: isMonarchFn,
        provider: identityCtx.transport,
      });

      const userRole = accessPack?.userRole || "guest";
      const userPlan = accessPack?.userPlan || "free";
      const user =
        accessPack?.user || {
          role: userRole,
          plan: userPlan,
        };

      // permission helper (reply-safe) — permGuard ТРЕБУЕТ msg
      const requirePermOrReply = buildRequirePermOrReply({
        bot,
        msg,
        MONARCH_USER_ID,
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

        // Normalize commands like "/start@MyBot"
        const cmdBase = String(cmd || "").split("@")[0];

        // ======================================================================
        // === ALWAYS-HANDLE BASIC COMMANDS (avoid CMD_ACTION interception)
        // ======================================================================
        if (cmdBase === "/start") {
          await bot.sendMessage(
            chatId,
            [
              "✅ SG online.",
              "",
              "Базовые команды:",
              "- /link_start — начать привязку identity",
              "- /link_confirm <code> — подтвердить привязку",
              "- /link_status — проверить статус",
              "",
              "ℹ️ /help — подсказка по командам (в зависимости от прав).",
            ].join("\n")
          );
          return;
        }

        if (cmdBase === "/help") {
          await bot.sendMessage(
            chatId,
            [
              "ℹ️ Help",
              "",
              "Базовые команды:",
              "- /link_start",
              "- /link_confirm <code>",
              "- /link_status",
              "",
              "Dev/системные команды — только для монарха в личке.",
            ].join("\n")
          );
          return;
        }
        // ======================================================================

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

          // ✅ Build info (deployment verification)
          "/build_info",

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

          // ✅ STAGE 4.x: tasks owner / identity diagnostics
          "/tasks_owner_diag",

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

        const isDev = DEV_COMMANDS.has(cmdBase);

        if (isDev && (!isMonarchUser || !isPrivate)) {
          // Silent block (no replies, no leakage)
          return;
        }
        // ======================================================================

        // FORCE /reindex to bypass CMD_ACTION routing (monarch DM only)
        if (cmdBase === "/reindex") {
          await handleReindexRepo({ bot, chatId });
          return;
        }

        // ✅ BYPASS CMD_ACTION for Project Memory ops (avoid silent dispatch)
        if (cmdBase === "/pm_show") {
          await handlePmShow({
            bot,
            chatId,
            rest,
            getProjectSection,
          });
          return;
        }

        if (cmdBase === "/pm_set") {
          await handlePmSet({
            bot,
            chatId,
            chatIdStr,
            rest,
            upsertProjectSection,
            bypass: true,
          });
          return;
        }

        // ✅ BYPASS CMD_ACTION for /build_info (so autosave always runs here)
        if (cmdBase === "/build_info") {
          const commit =
            String(process.env.RENDER_GIT_COMMIT || "").trim() ||
            String(process.env.GIT_COMMIT || "").trim() ||
            "unknown";

          const serviceId =
            String(process.env.RENDER_SERVICE_ID || "").trim() || "unknown";

          const instanceId =
            String(process.env.RENDER_INSTANCE_ID || "").trim() ||
            String(process.env.HOSTNAME || "").trim() ||
            "unknown";

          const nodeEnv = String(process.env.NODE_ENV || "").trim() || "unknown";

          const nowIso = new Date().toISOString();

          // ✅ AUTO-SAVE: DEPLOY VERIFIED → project memory (monarch DM only via dev-gate above)
          if (typeof upsertProjectSection === "function") {
            const content = [
              `DEPLOY VERIFIED`,
              `ts: ${nowIso}`,
              `commit: ${commit}`,
              `service: ${serviceId}`,
              `instance: ${instanceId}`,
              `node_env: ${nodeEnv}`,
            ].join("\n");

            try {
              await upsertProjectSection({
                section: "deploy.last_verified",
                title: "DEPLOY VERIFIED",
                content,
                tags: ["deploy", "build_info"],
                meta: { commit, serviceId, instanceId, nodeEnv, ts: nowIso },
                schemaVersion: 1,
              });
            } catch (e) {
              // do not break /build_info if memory write fails
              console.error("build_info autosave failed:", e);
            }
          }

          await bot.sendMessage(
            chatId,
            [
              "🧩 BUILD INFO",
              `commit: ${commit}`,
              `service: ${serviceId}`,
              `instance: ${instanceId}`,
              `node_env: ${nodeEnv}`,
            ].join("\n")
          );
          return;
        }

        // command router (some legacy commands are mapped)
        const action = CMD_ACTION[cmdBase];

        // STAGE 4 DEEP: admin-actions are private-only + monarch-only (even if invoked in groups)
        if (
          action &&
          typeof action === "string" &&
          action.startsWith("cmd.admin.") &&
          (!isMonarchUser || !isPrivate)
        ) {
          return; // silent block
        }

        if (action) {
          // Stage 3.3: permissions-layer enforcement (can() + access request flow)
          const allowed = await requirePermOrReply(cmdBase, { rest, identityCtx });
          if (!allowed) return;

          // Stage 3.5: rate-limit commands (skip for monarch)
          if (!isMonarchUser) {
            const key = `${senderIdStr}:${chatIdStr}:cmd`;
            const rl = checkCmdRateLimit(key);
            if (!rl.allowed) {
              const sec = Math.ceil(rl.retryAfterMs / 1000);
              await bot.sendMessage(chatId, `⛔ Слишком часто. Подожди ${sec} сек.`);
              return;
            }
          }

          // ✅ FIX: dispatchCommand must receive (cmd, ctx)
          const ctx = {
            action,
            bot,
            msg,
            chatId,
            chatIdStr,
            senderIdStr,
            chatType,
            isPrivateChat: isPrivate,
            identityCtx,
            rest,
            requirePermOrReply,

            // ✅ identity-first: pass resolved user + role/plan + bypass
            user,
            userRole,
            userPlan,
            bypass: isMonarchUser,

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

            // coingecko (kept for compatibility if dispatcher uses it)
            getCoinGeckoSimplePriceById,
            getCoinGeckoSimplePriceMulti,
          };

          await dispatchCommand(cmdBase, ctx);
          return;
        }

        // inline switch (kept for backward compatibility)
        switch (cmdBase) {
          case "/approve": {
            await handleApprove({ bot, chatId, rest });
            return;
          }

          case "/deny": {
            await handleDeny({ bot, chatId, rest });
            return;
          }

          case "/reindex": {
            await handleReindexRepo({ bot, chatId });
            return;
          }

          // ✅ STAGE 4.x: tasks owner / identity diagnostics (monarch DM only via dev-gate)
          case "/tasks_owner_diag": {
            try {
              const colRes = await pool.query(
                `
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'tasks'
                  AND column_name = 'user_global_id'
                LIMIT 1
                `
              );

              const hasUserGlobalId = (colRes.rows?.length || 0) > 0;

              // summary counts
              const summaryQuery = hasUserGlobalId
                ? `
                  SELECT
                    COUNT(*)::int AS total,
                    SUM(CASE WHEN user_chat_id IS NULL OR user_chat_id = '' THEN 1 ELSE 0 END)::int AS chat_id_missing,
                    SUM(CASE WHEN user_global_id IS NULL OR user_global_id = '' THEN 1 ELSE 0 END)::int AS global_id_missing
                  FROM tasks
                `
                : `
                  SELECT
                    COUNT(*)::int AS total,
                    SUM(CASE WHEN user_chat_id IS NULL OR user_chat_id = '' THEN 1 ELSE 0 END)::int AS chat_id_missing
                  FROM tasks
                `;

              const sumRes = await pool.query(summaryQuery);
              const s = sumRes.rows?.[0] || {};

              // last tasks preview
              const listQuery = hasUserGlobalId
                ? `
                  SELECT id, type, status, user_chat_id, user_global_id, created_at, last_run
                  FROM tasks
                  ORDER BY id DESC
                  LIMIT 20
                `
                : `
                  SELECT id, type, status, user_chat_id, created_at, last_run
                  FROM tasks
                  ORDER BY id DESC
                  LIMIT 20
                `;

              const listRes = await pool.query(listQuery);
              const rows = listRes.rows || [];

              const lines = [];
              lines.push("🧪 TASKS OWNER DIAG");
              lines.push(`has tasks.user_global_id: ${hasUserGlobalId ? "YES" : "NO"}`);
              lines.push(`total tasks: ${s.total ?? 0}`);
              lines.push(`missing user_chat_id: ${s.chat_id_missing ?? 0}`);
              if (hasUserGlobalId) lines.push(`missing user_global_id: ${s.global_id_missing ?? 0}`);
              lines.push("");
              lines.push("Last 20 tasks:");

              for (const r of rows) {
                const created = r.created_at ? new Date(r.created_at).toISOString() : "—";
                const lastRun = r.last_run ? new Date(r.last_run).toISOString() : "—";
                if (hasUserGlobalId) {
                  lines.push(
                    `#${r.id} | ${r.type} | ${r.status} | chat=${r.user_chat_id || "—"} | global=${r.user_global_id || "—"} | created=${created} | last_run=${lastRun}`
                  );
                } else {
                  lines.push(
                    `#${r.id} | ${r.type} | ${r.status} | chat=${r.user_chat_id || "—"} | created=${created} | last_run=${lastRun}`
                  );
                }
              }

              await bot.sendMessage(chatId, lines.join("\n").slice(0, 3800));
            } catch (e) {
              console.error("❌ /tasks_owner_diag error:", e);
              await bot.sendMessage(
                chatId,
                "⚠️ /tasks_owner_diag упал. Проверь: есть ли таблица tasks и применена ли миграция 007 (колонка user_global_id)."
              );
            }
            return;
          }

          // Step 4: status-only flag (NO enable logic, NO code generation)
          case "/code_output_status": {
            const mode = getCodeOutputMode();

            await bot.sendMessage(
              chatId,
              [
                `CODE_OUTPUT_MODE: ${mode}`,
                "",
                "Modes:",
                "- DISABLED → генерация запрещена",
                "- DRY_RUN → только валидация без AI",
                "- ENABLED → реальная генерация кода",
              ].join("\n")
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
            await handleArList({ bot, chatId, rest });
            return;
          }

          case "/file_logs": {
            await handleFileLogs({ bot, chatId, chatIdStr, rest });
            return;
          }

          case "/demo_task": {
            await handleDemoTask({ bot, chatId, chatIdStr, createDemoTask });
            return;
          }

          case "/stop_all": {
            await handleStopAllTasks({
              bot,
              chatId,
              chatIdStr,
              canStopTaskV1,
            });
            return;
          }

          case "/run_task_cmd": {
            await handleRunTaskCmd({
              bot,
              chatId,
              chatIdStr,
              rest,
              isOwnerTaskRow,
            });
            return;
          }

          case "/sources": {
            await handleSourcesList({
              bot,
              chatId,
              chatIdStr,
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
              runSourceDiagnosticsOnce,
            });
            return;
          }

          case "/source": {
            await handleSource({
              bot,
              chatId,
              chatIdStr,
              rest,
              fetchFromSourceKey,
            });
            return;
          }

          case "/diag_source": {
            await handleDiagSource({
              bot,
              chatId,
              chatIdStr,
              rest,
              diagnoseSource,
            });
            return;
          }

          case "/test_source": {
            await handleTestSource({
              bot,
              chatId,
              chatIdStr,
              rest,
              testSource,
            });
            return;
          }

          case "/tasks": {
            await handleTasksList({ bot, chatId, chatIdStr, getUserTasks });
            return;
          }

          case "/start_task": {
            await handleStartTask({
              bot,
              chatId,
              chatIdStr,
              rest,
              updateTaskStatus,
            });
            return;
          }

          case "/stop_task": {
            await handleStopTask({
              bot,
              chatId,
              chatIdStr,
              rest,
              canStopTaskV1,
              updateTaskStatus,
            });
            return;
          }

          case "/run_task": {
            await handleRunTask({
              bot,
              chatId,
              chatIdStr,
              rest,
              runTaskWithAI,
            });
            return;
          }

          case "/new_task": {
            await handleNewTask({
              bot,
              chatId,
              chatIdStr,
              rest,
              createManualTask,
            });
            return;
          }

          case "/btc_test_task": {
            await handleBtcTestTask({
              bot,
              chatId,
              chatIdStr,
              rest,
              createTestPriceMonitorTask,
            });
            return;
          }

          default: {
            // неизвестная команда — игнор (поведение без изменений)
            break;
          }
        } // end switch (cmdBase)

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
