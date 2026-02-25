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

// ✅ STAGE 6.4 — derive chat meta in core
import { deriveChatMeta } from "../core/transportMeta.js";

// ✅ STAGE 6 — shadow wiring (no behavior change)
import { handleMessage as handleMessageCore } from "../core/handleMessage.js";

import {
  parseCommand,
  callWithFallback,
  canStopTaskV1,
  sanitizeNonMonarchReply,
} from "../../core/helpers.js";

// === MEMORY (via bridge, STAGE 7) ===
import { getChatHistory, saveMessageToMemory, saveChatPair } from "./memory/memoryBridge.js";

// === MEMORY LAYER V1 (SKELETON) ===
import { getMemoryService } from "../core/memoryServiceFactory.js";

// ✅ STAGE 7: move memory diagnostics SQL out of router
import MemoryDiagnosticsService from "../core/MemoryDiagnosticsService.js";

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
import BehaviorEventsService from "../logging/BehaviorEventsService.js";

// ✅ STAGE 5.16.2 — DEV verify tool
import { handleBehaviorEventsLast } from "./handlers/behaviorEventsLast.js";

// ✅ Project Memory service (read)
import { getProjectSection } from "../../projectMemory.js";

// ============================================================================
// Stage 3.5: COMMAND RATE-LIMIT (in-memory, per instance)
// ============================================================================
const CMD_RL_WINDOW_MS = Math.max(1000, Number(process.env.CMD_RL_WINDOW_MS || 20000));
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
export function attachMessageRouter({ bot, callAI, upsertProjectSection, MAX_HISTORY_MESSAGES = 20 }) {
  bot.on("message", async (msg) => {
    try {
      const behaviorEvents = new BehaviorEventsService();
      const memDiag = new MemoryDiagnosticsService({ db: pool });

      const chatId = msg.chat?.id;
      if (!chatId) return;

      const chatIdStr = String(chatId);
      const senderIdStr = String(msg.from?.id || "");
      const text = String(msg.text || "");
      const trimmed = text.trim();

      // ✅ STAGE 6.5 — NO direct msg.chat.type usage here.
      // Minimal deterministic heuristic:
      // - private if chatId == senderId
      // - otherwise treat as group
      const transportChatType =
        chatIdStr && senderIdStr && chatIdStr === senderIdStr ? "private" : "group";

      const meta = deriveChatMeta({
        transport: "telegram",
        chatId: chatIdStr,
        senderId: senderIdStr,
        transportChatType,
      });

      const chatType = meta.chatType;
      const isPrivate = meta.isPrivateChat;

      if (!senderIdStr) return;

      await ensureUserProfile(msg);

      const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "").trim();
      const isMonarchFn = (idStr) => String(idStr || "") === MONARCH_USER_ID;
      const isMonarchUser = isMonarchFn(senderIdStr);

      const identityCtx = {
        transport: "telegram",
        senderIdStr,
        chatIdStr,
        chatType,
        isPrivateChat: isPrivate,
        isMonarchUser,
        MONARCH_USER_ID,
      };

      const accessPack = await resolveUserAccess({
        senderIdStr,
        isMonarch: isMonarchFn,
        provider: identityCtx.transport,
      });

      // ✅ globalUserId for Stage 6 core (unified identity)
      const globalUserId = accessPack?.user?.global_user_id || accessPack?.global_user_id || null;

      // ✅ STAGE 6 shadow wiring: call core handleMessage(context) WITHOUT affecting replies
      // ✅ STAGE 6.6: DO NOT pass transportChatType into core (transport-specific detail)
      try {
        await handleMessageCore({
          transport: "telegram",
          chatId: chatIdStr,
          senderId: senderIdStr,
          chatType,
          isPrivateChat: isPrivate,
          text: trimmed,
          globalUserId,
        });
      } catch (e) {
        // Never block Telegram flow on Stage 6 skeleton
        console.error("handleMessageCore(SHADOW) failed:", e);
      }

      const userRole = accessPack?.userRole || "guest";
      const userPlan = accessPack?.userPlan || "free";
      const user =
        accessPack?.user || {
          role: userRole,
          plan: userPlan,
        };

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
        const cmdBase = String(cmd || "").split("@")[0];

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

        const DEV_COMMANDS = new Set([
          "/reindex",
          "/repo_get",
          "/repo_check",
          "/repo_review",
          "/repo_analyze",
          "/repo_diff",
          "/code_fullfile",
          "/code_insert",
          "/code_output_status",
          "/workflow_check",
          "/build_info",
          "/pm_set",
          "/pm_show",
          "/memory_status",
          "/memory_diag",
          "/memory_integrity",
          "/memory_backfill",
          "/memory_user_chats", // ✅ NEW
          "/chat_meta_debug",
          "/behavior_events_last",
          "/tasks",
          "/start_task",
          "/stop_task",
          "/stop_all",
          "/run_task",
          "/run_task_cmd",
          "/new_task",
          "/demo_task",
          "/btc_test_task",
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
        // ✅ No DEV commands allowed in groups. Single policy point: commandDispatcher.js (PRIVATE-only).
        const devAllowInGroup = false;

        if (isDev && (!isMonarchUser || (!isPrivate && !devAllowInGroup))) {
          await bot.sendMessage(
            chatId,
            [
              "⛔ DEV only.",
              `cmd=${cmdBase}`,
              `chatType=${chatType}`,
              `private=${isPrivate}`,
              `monarch=${isMonarchUser}`,
              `chatId=${chatIdStr}`,
              `from=${senderIdStr}`,
              `transportChatType=${String(transportChatType || "")}`,
              `chatIdEqFrom=${chatIdStr === senderIdStr}`,
            ].join("\n")
          );

          try {
            await behaviorEvents.logEvent({
              globalUserId: accessPack?.user?.global_user_id || null,
              chatId: chatIdStr,
              eventType: "risk_warning_shown",
              metadata: {
                reason: "dev_only_command",
                command: cmdBase,
              },
            });
          } catch (e) {
            console.error("behavior_events log failed:", e);
          }

          return;
        }

        // ✅ /memory_status
        if (cmdBase === "/memory_status") {
          const memory = getMemoryService();
          const status = await memory.status();
          const v2Cols = await memDiag.getChatMemoryV2Columns();

          await bot.sendMessage(
            chatId,
            [
              "🧠 MEMORY STATUS",
              `enabled: ${status.enabled}`,
              `mode: ${status.mode}`,
              `hasDb: ${status.hasDb}`,
              `hasLogger: ${status.hasLogger}`,
              `hasChatAdapter: ${status.hasChatAdapter}`,
              `configKeys: ${status.configKeys.join(", ")}`,
              "",
              "DB chat_memory V2 columns:",
              `global_user_id: ${v2Cols.global_user_id}`,
              `transport: ${v2Cols.transport}`,
              `metadata: ${v2Cols.metadata}`,
              `schema_version: ${v2Cols.schema_version}`,
              "",
              "ENV (raw):",
              `MEMORY_ENABLED: ${String(process.env.MEMORY_ENABLED || "")}`,
              `MEMORY_MODE: ${String(process.env.MEMORY_MODE || "")}`,
              `NODE_ENV: ${String(process.env.NODE_ENV || "")}`,
              "",
              "BUILD:",
              `commit: ${String(process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || "")}`,
              `service: ${String(process.env.RENDER_SERVICE_ID || "")}`,
              `instance: ${String(process.env.RENDER_INSTANCE_ID || process.env.HOSTNAME || "")}`,
            ].join("\n")
          );

          return;
        }

        // ✅ /memory_diag
        if (cmdBase === "/memory_diag") {
          const globalUserId2 = accessPack?.user?.global_user_id || accessPack?.global_user_id || null;
          const out = await memDiag.memoryDiag({ chatIdStr, globalUserId: globalUserId2 });
          await bot.sendMessage(chatId, out);
          return;
        }

        // ✅ /memory_integrity
        if (cmdBase === "/memory_integrity") {
          const out = await memDiag.memoryIntegrity({ chatIdStr });
          await bot.sendMessage(chatId, out);
          return;
        }

        // ✅ /memory_backfill
        if (cmdBase === "/memory_backfill") {
          const globalUserId2 = accessPack?.user?.global_user_id || accessPack?.global_user_id || null;
          const rawN = Number(String(rest || "").trim() || "200");
          const limit = Number.isFinite(rawN) ? Math.max(1, Math.min(500, rawN)) : 200;

          const out = await memDiag.memoryBackfill({ chatIdStr, globalUserId: globalUserId2, limit });
          await bot.sendMessage(chatId, out);
          return;
        }

        // ✅ NEW: /memory_user_chats — list other chats that contain rows for this user
        if (cmdBase === "/memory_user_chats") {
          const globalUserId2 = accessPack?.user?.global_user_id || accessPack?.global_user_id || null;
          const out = await memDiag.memoryUserChats({ globalUserId: globalUserId2 });
          await bot.sendMessage(chatId, out);
          return;
        }

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

        if (cmdBase === "/build_info") {
          const commit =
            String(process.env.RENDER_GIT_COMMIT || "").trim() ||
            String(process.env.GIT_COMMIT || "").trim() ||
            "unknown";

          const serviceId = String(process.env.RENDER_SERVICE_ID || "").trim() || "unknown";

          const instanceId =
            String(process.env.RENDER_INSTANCE_ID || "").trim() ||
            String(process.env.HOSTNAME || "").trim() ||
            "unknown";

          const nodeEnv = String(process.env.NODE_ENV || "").trim() || "unknown";
          const nowIso = new Date().toISOString();

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
              console.error("build_info autosave failed:", e);
            }
          }

          await bot.sendMessage(
            chatId,
            ["🧩 BUILD INFO", `commit: ${commit}`, `service: ${serviceId}`, `instance: ${instanceId}`, `node_env: ${nodeEnv}`].join("\n")
          );
          return;
        }

        const action = CMD_ACTION[cmdBase];

        if (
          action &&
          typeof action === "string" &&
          action.startsWith("cmd.admin.") &&
          (!isMonarchUser || !isPrivate)
        ) {
          return;
        }

        if (action) {
          const allowed = await requirePermOrReply(cmdBase, { rest, identityCtx });
          if (!allowed) {
            try {
              await behaviorEvents.logEvent({
                globalUserId: accessPack?.user?.global_user_id || null,
                chatId: chatIdStr,
                eventType: "permission_denied",
                metadata: {
                  cmd: cmdBase,
                  chatType,
                  private: isPrivate,
                  from: senderIdStr,
                  role: userRole,
                  plan: userPlan,
                },
                transport: "telegram",
                schemaVersion: 1,
              });
            } catch (e) {
              console.error("behavior_events permission_denied log failed:", e);
            }
            return;
          }

          if (!isMonarchUser) {
            const key = `${senderIdStr}:${chatIdStr}:cmd`;
            const rl = checkCmdRateLimit(key);
            if (!rl.allowed) {
              const sec = Math.ceil(rl.retryAfterMs / 1000);

              try {
                await behaviorEvents.logEvent({
                  globalUserId: accessPack?.user?.global_user_id || null,
                  chatId: chatIdStr,
                  eventType: "rate_limited",
                  metadata: {
                    scope: "command",
                    cmd: cmdBase,
                    retry_after_sec: sec,
                    window_ms: CMD_RL_WINDOW_MS,
                    max: CMD_RL_MAX,
                    from: senderIdStr,
                    chatType,
                  },
                  transport: "telegram",
                  schemaVersion: 1,
                });
              } catch (e) {
                console.error("behavior_events rate_limited log failed:", e);
              }

              await bot.sendMessage(chatId, `⛔ Слишком часто. Подожди ${sec} сек.`);
              return;
            }
          }

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

            user,
            userRole,
            userPlan,
            bypass: isMonarchUser,

            pool,
            callAI,
            logInteraction,

            callWithFallback,

            createDemoTask,
            createManualTask,
            createTestPriceMonitorTask,
            getUserTasks,
            getTaskById,
            runTaskWithAI,
            updateTaskStatus,

            runSourceDiagnosticsOnce,
            getAllSourcesSafe,
            fetchFromSourceKey,
            formatSourcesList,
            diagnoseSource,
            testSource,

            getAnswerMode,
            setAnswerMode,

            getCoinGeckoSimplePriceById,
            getCoinGeckoSimplePriceMulti,
          };

          await dispatchCommand(cmdBase, ctx);
          return;
        }

        switch (cmdBase) {
          case "/approve": {
            await handleApprove({ bot, chatId, rest });
            return;
          }

          case "/deny": {
            await handleDeny({ bot, chatId, rest });
            return;
          }

          case "/behavior_events_last": {
            await handleBehaviorEventsLast({
              bot,
              chatId,
              rest,
              senderIdStr,
            });
            return;
          }

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

              const summaryQuery = hasUserGlobalId
                ? `
                  SELECT
                    COUNT(*)::int AS total,
                    SUM(CASE WHEN user_global_id IS NULL OR user_global_id = '' THEN 1 ELSE 0 END)::int AS global_id_missing
                  FROM tasks
                `
                : `
                  SELECT
                    COUNT(*)::int AS total
                  FROM tasks
                `;

              const sumRes = await pool.query(summaryQuery);
              const s = sumRes.rows?.[0] || {};

              const listQuery = hasUserGlobalId
                ? `
                  SELECT id, type, status, user_global_id, created_at, last_run
                  FROM tasks
                  ORDER BY id DESC
                  LIMIT 20
                `
                : `
                  SELECT id, type, status, created_at, last_run
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
              if (hasUserGlobalId) lines.push(`missing user_global_id: ${s.global_id_missing ?? 0}`);
              lines.push("");
              lines.push("Last 20 tasks:");

              for (const r of rows) {
                const created = r.created_at ? new Date(r.created_at).toISOString() : "—";
                const lastRun = r.last_run ? new Date(r.last_run).toISOString() : "—";
                if (hasUserGlobalId) {
                  lines.push(
                    `#${r.id} | ${r.type} | ${r.status} | global=${r.user_global_id || "—"} | created=${created} | last_run=${lastRun}`
                  );
                } else {
                  lines.push(`#${r.id} | ${r.type} | ${r.status} | created=${created} | last_run=${lastRun}`);
                }
              }

              await bot.sendMessage(chatId, lines.join("\n").slice(0, 3800));
            } catch (e) {
              console.error("❌ /tasks_owner_diag error:", e);
              await bot.sendMessage(
                chatId,
                "⚠️ /tasks_owner_diag упал. Проверь: есть ли таблица tasks и применена ли миграция (колонка user_global_id)."
              );
            }
            return;
          }

          case "/demo_task": {
            await handleDemoTask({
              bot,
              chatId,
              chatIdStr,
              access: accessPack,
              callWithFallback,
              createDemoTask,
            });
            return;
          }

          case "/new_task": {
            await handleNewTask({
              bot,
              chatId,
              chatIdStr,
              rest,
              access: accessPack,
              callWithFallback,
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
              access: accessPack,
              callWithFallback,
              createTestPriceMonitorTask,
            });
            return;
          }

          case "/tasks": {
            await handleTasksList({
              bot,
              chatId,
              chatIdStr,
              getUserTasks,
              access: accessPack,
            });
            return;
          }

          case "/run_task": {
            await handleRunTask({
              bot,
              chatId,
              chatIdStr,
              rest,
              access: accessPack,
              getTaskById,
              runTaskWithAI,
            });
            return;
          }

          case "/start_task": {
            await handleStartTask({
              bot,
              chatId,
              rest,
              bypass: isMonarchUser,
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
              userRole,
              bypass: isMonarchUser,
              getTaskById,
              canStopTaskV1,
              updateTaskStatus,
              access: accessPack,
            });
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
              access: accessPack,
              callWithFallback,
            });
            return;
          }

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
            await handleRepoGet({ bot, chatId, rest, senderIdStr });
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
            await handleCodeFullfile({ bot, chatId, rest, callAI, senderIdStr });
            return;
          }

          case "/code_insert": {
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

          case "/chat_meta_debug": {
            await dispatchCommand(cmdBase, {
              bot,
              msg, // ✅ pass msg to remove fallback dependence
              identityCtx, // ✅ pass identityCtx to remove fallback dependence
              chatId,
              chatIdStr,
              senderIdStr,
              chatType, // ✅ useful for gate
              isPrivateChat: isPrivate, // ✅ explicit flag
              rest, // ✅ keep rest consistent
              userRole,
              userPlan,
              user,
              bypass: isMonarchUser,
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

          default: {
            break;
          }
        }

        return;
      }

      // ======================================================================
      // === NOT COMMANDS: FILE-INTAKE + MEMORY + CONTEXT + AI ===
      // ======================================================================

      await handleChatMessage({
        bot,
        msg,
        chatId,
        chatIdStr,
        senderIdStr,
        globalUserId,
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

        isMonarch: isMonarchFn,

        callAI,
        sanitizeNonMonarchReply,
      });

      return;
    } catch (e) {
      console.error("messageRouter error:", e);
    }
  });
}
