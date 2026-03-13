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

// ✅ STAGE 4 — Chats wiring (best-effort, no behavior change)
import { upsertChat } from "../db/chatRepo.js";
import { touchUserChatLink } from "../db/userChatLinkRepo.js";

// ✅ STAGE 4.3 — Chat Gate (db)
import { getChatById } from "../db/chatRepo.js";

import { dispatchCommand } from "./commandDispatcher.js";

// === CORE ===
import { getAnswerMode, setAnswerMode } from "../../core/answerMode.js";
import { loadProjectContext } from "../../core/projectContext.js";
import { buildSystemPrompt } from "../../systemPrompt.js";

// ✅ STAGE 6 — shadow wiring (no behavior change)
import { handleMessage as handleMessageCore } from "../core/handleMessage.js";

// ✅ STAGE 6 — Transport skeleton pieces (no behavior change)
import { createUnifiedContext } from "../transport/unifiedContext.js";
import { toCoreContextFromUnified } from "../transport/toCoreContext.js";
import {
  isTransportEnforced,
  isTransportTraceEnabled,
} from "../transport/transportConfig.js";

import {
  parseCommand,
  callWithFallback,
  canStopTaskV1,
  sanitizeNonMonarchReply,
} from "../../core/helpers.js";

// === MEMORY (bridge) ===
// ✅ STAGE 7.3: stop memory writes from router; keep read-only history for chat context
import { getChatHistory } from "./memory/memoryBridge.js";

// ✅ STAGE 7: move memory diagnostics SQL out of router
import MemoryDiagnosticsService from "../core/MemoryDiagnosticsService.js";

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
import { handleChatMessagesDiag } from "./handlers/chatMessagesDiag.js";

// ✅ Project Memory service (read)
import { getProjectSection } from "../../projectMemory.js";

// ✅ Stage 3.5 — RateLimit (V1)
import { checkRateLimit } from "./rateLimiter.js";

// ✅ Stage 3.6 — Config hygiene (V1)
import { envIntRange, envStr, getPublicEnvSnapshot } from "../core/config.js";

// ✅ STAGE 6.8.2 — COMMAND IDEMPOTENCY (DB guard)
import { insertCommandInvocation } from "../db/commandInvocationsRepo.js";

// ✅ STAGE 6.8.2 — OBSERVABILITY (reuse webhook_dedupe_events)
import { insertWebhookDedupeEvent } from "../db/chatMessagesRepo.js";

// ✅ SPLIT — extracted from messageRouter.js
import {
  ctxReplyCommand,
  forcePairMessageId,
} from "./router/ctxReplyCommand.js";
import { devCommandGate } from "./router/devCommandGate.js";
import { createChatMemoryWriters } from "./router/chatMemoryWriters.js";
import { runTransportShadowFlow } from "./router/transportShadowRunner.js";
import { createRouterCommandContext } from "./router/routerCommandContext.js";
import { handleBuildInfoCommand } from "./router/buildInfoCommand.js";
import { handleCodeOutputStatusCommand } from "./router/codeOutputStatusCommand.js";
import { handleMemoryUserChatsCommand } from "./router/memoryUserChatsCommand.js";
import { handleMemoryDiagCommand } from "./router/memoryDiagCommand.js";
import { handleMemoryIntegrityCommand } from "./router/memoryIntegrityCommand.js";
import { handleMemoryBackfillCommand } from "./router/memoryBackfillCommand.js";
import { handleMemoryStatusCommand } from "./router/memoryStatusCommand.js";
import { handleChatDiagCommand } from "./router/chatDiagCommand.js";
import { handleTasksOwnerDiagCommand } from "./router/tasksOwnerDiagCommand.js";
import { handleApproveCommand } from "./router/approveCommand.js";
import { handleDenyCommand } from "./router/denyCommand.js";
import { handleBehaviorEventsLastCommand } from "./router/behaviorEventsLastCommand.js";
import { handleChatMessagesDiagCommand } from "./router/chatMessagesDiagCommand.js";
import { handleDemoTaskCommand } from "./router/demoTaskCommand.js";
import { handleNewTaskCommand } from "./router/newTaskCommand.js";
import { handleBtcTestTaskCommand } from "./router/btcTestTaskCommand.js";
import { handleTasksCommand } from "./router/tasksCommand.js";
import { handleRunTaskCommand } from "./router/runTaskCommand.js";
import { handleStartTaskCommand } from "./router/startTaskCommand.js";
import { handleStopTaskCommand } from "./router/stopTaskCommand.js";
import { handleStopAllCommand } from "./router/stopAllCommand.js";
import { handleWorkflowCheckCommand } from "./router/workflowCheckCommand.js";
import { handleRepoStatusCommand } from "./router/repoStatusCommand.js";
import { handleRepoTreeCommand } from "./router/repoTreeCommand.js";
import { handleRepoFileCommand } from "./router/repoFileCommand.js";
import { handleRepoReview2Command } from "./router/repoReview2Command.js";
import { handleRepoSearchCommand } from "./router/repoSearchCommand.js";
import { handleRepoGetCommand } from "./router/repoGetCommand.js";
import { handleRepoCheckCommand } from "./router/repoCheckCommand.js";
import { handleRepoAnalyzeCommand } from "./router/repoAnalyzeCommand.js";
import { handleRepoReviewCommand } from "./router/repoReviewCommand.js";
import { handleRepoDiffCommand } from "./router/repoDiffCommand.js";
import { handleArListCommand } from "./router/arListCommand.js";
import { handleFileLogsCommand } from "./router/fileLogsCommand.js";
import { handleSourcesCommand } from "./router/sourcesCommand.js";
import { handleSourcesDiagCommand } from "./router/sourcesDiagCommand.js";
import { handleSourceCommand } from "./router/sourceCommand.js";
import { handleDiagSourceCommand } from "./router/diagSourceCommand.js";
import { handleTestSourceCommand } from "./router/testSourceCommand.js";
import { handlePmShowCommand } from "./router/pmShowCommand.js";
import { handlePmSetCommand } from "./router/pmSetCommand.js";
import { handleRunTaskCmdCommand } from "./router/runTaskCmdCommand.js";

// ============================================================================
// Stage 3.5: COMMAND RATE-LIMIT (in-memory, per instance)
// ============================================================================
// Default: 6 commands / 20 sec for non-monarch
const CMD_RL_WINDOW_MS = envIntRange("CMD_RL_WINDOW_MS", 20000, {
  min: 1000,
  max: 300000,
});
const CMD_RL_MAX = envIntRange("CMD_RL_MAX", 6, { min: 1, max: 50 });

// ============================================================================
// ✅ STAGE 4.3: CHAT GATE (ENV-driven, mode=db)
// ============================================================================
// CHAT_GATE_MODE: "off" | "db"
// CHAT_DEFAULT_ACTIVE: "true"/"false" (applied on INSERT only; see chatRepo.upsertChat)
const CHAT_GATE_MODE = envStr("CHAT_GATE_MODE", "off").trim().toLowerCase();
const CHAT_DEFAULT_ACTIVE_RAW = envStr("CHAT_DEFAULT_ACTIVE", "true")
  .trim()
  .toLowerCase();
const CHAT_DEFAULT_ACTIVE = ["1", "true", "yes", "y", "on"].includes(
  CHAT_DEFAULT_ACTIVE_RAW
);

// ============================================================================
// === ATTACH ROUTER
// ============================================================================
export function attachMessageRouter({
  bot,
  callAI,
  upsertProjectSection,
  MAX_HISTORY_MESSAGES = 20,
}) {
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

      // ✅ STAGE 6 cleanup: router uses ONLY raw transport meta (no deriveChatMeta here)
      const transportChatTypeRaw = String(msg.chat?.type || "").trim();

      // fallback for edge cases where Telegram type is missing
      const isPrivate =
        transportChatTypeRaw === "private" ||
        (chatIdStr && senderIdStr && chatIdStr === senderIdStr);
      const chatType = transportChatTypeRaw || (isPrivate ? "private" : "group");

      // keep variable name for core shadow wiring (raw-ish transport hint)
      const transportChatType = transportChatTypeRaw;

      if (!senderIdStr) return;

      await ensureUserProfile(msg);

      const MONARCH_USER_ID = envStr("MONARCH_USER_ID", "").trim();
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
      const globalUserId =
        accessPack?.user?.global_user_id || accessPack?.global_user_id || null;

      // ✅ STAGE 4 wiring (best-effort, NEVER block telegram flow)
      try {
        const nowIso = new Date().toISOString();
        const title =
          String(msg.chat?.title || "").trim() ||
          [msg.chat?.first_name, msg.chat?.last_name]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          null;

        await upsertChat({
          chatId: chatIdStr,
          transport: "telegram",
          chatType: chatType || null,
          title,
          // ✅ STAGE 4.3: apply default active on INSERT only (if gate enabled)
          isActiveInsert: CHAT_GATE_MODE === "db" ? CHAT_DEFAULT_ACTIVE : null,
          lastSeenAt: nowIso,
          meta: null,
        });
      } catch (e) {
        console.error("Stage4 upsertChat failed:", e);
      }

      if (globalUserId) {
        try {
          const nowIso = new Date().toISOString();
          await touchUserChatLink({
            globalUserId,
            chatId: chatIdStr,
            transport: "telegram",
            lastSeenAt: nowIso,
            meta: null,
          });
        } catch (e) {
          console.error("Stage4 touchUserChatLink failed:", e);
        }
      }

      // ✅ STAGE 4.3 — CHAT GATE (mode=db)
      // Blocks ALL processing for inactive chats (monarch bypass).
      // Best-effort: DB issues must NOT block Telegram flow.
      if (CHAT_GATE_MODE === "db") {
        try {
          const chatRow = await getChatById({
            chatId: chatIdStr,
            transport: "telegram",
          });

          const isActive =
            chatRow && typeof chatRow.is_active !== "undefined"
              ? !!chatRow.is_active
              : true;

          if (!isActive && !isMonarchUser) {
            try {
              await behaviorEvents.logEvent({
                globalUserId: accessPack?.user?.global_user_id || null,
                chatId: chatIdStr,
                eventType: "chat_gated",
                metadata: {
                  reason: "chat_inactive",
                  chat_id: chatIdStr,
                  transport: "telegram",
                  chatType,
                  from: senderIdStr,
                },
                transport: "telegram",
                schemaVersion: 1,
              });
            } catch (e) {
              console.error("behavior_events chat_gated log failed:", e);
            }

            // Silent drop to avoid spam loops in group chats.
            return;
          }
        } catch (e) {
          console.error("Chat gate check failed:", e);
          // fail-open
        }
      }

      await runTransportShadowFlow({
        createUnifiedContext,
        toCoreContextFromUnified,
        isTransportEnforced,
        isTransportTraceEnabled,
        handleMessageCore,

        chatIdStr,
        senderIdStr,
        transportChatTypeRaw,
        isPrivate,
        trimmed,
        msg,
        globalUserId,
      });

      const userRole = accessPack?.userRole || "guest";
      const userPlan = accessPack?.userPlan || "free";
      const user =
        accessPack?.user || {
          role: userRole,
          plan: userPlan,
        };

      const { memory, ctxReply, requirePermOrReply } =
        createRouterCommandContext({
          bot,
          msg,
          chatId,
          chatIdStr,
          MONARCH_USER_ID,
          user,
          userRole,
          userPlan,
          trimmed,
          CMD_ACTION,
          globalUserId,
        });

      // =========================
      // === COMMANDS
      // =========================
      if (trimmed.startsWith("/")) {
        const { cmd, rest } = parseCommand(trimmed);
        const cmdBase = String(cmd || "").split("@")[0];

        // ==========================================================
        // STAGE 6.8.2 — COMMAND IDEMPOTENCY (critical)
        // Insert-first into command_invocations to guarantee process-once on webhook retries.
        // Strategy:
        // - Only when Telegram message_id is numeric
        // - INSERT ... ON CONFLICT DO NOTHING
        // - If conflict => already processed => exit WITHOUT side-effects
        // - Fail-open on DB error (do not break production)
        // ==========================================================
        const IDEMPOTENCY_BYPASS = new Set(["/start", "/help"]);
        const _cmdMessageId = msg.message_id ?? null;
        if (
          !IDEMPOTENCY_BYPASS.has(cmdBase) &&
          _cmdMessageId !== null &&
          Number.isFinite(Number(_cmdMessageId))
        ) {
          try {
            const transport = "telegram";

            const meta = {
              cmd: cmdBase,
              senderIdStr,
              chatIdStr,
              messageId: _cmdMessageId,
              globalUserId,
              stage: "6.8.2",
            };

            const ins = await insertCommandInvocation({
              transport,
              chatId: chatIdStr,
              messageId: _cmdMessageId,
              cmd: cmdBase,
              globalUserId: globalUserId || null,
              senderId: senderIdStr || null,
              metadata: meta,
            });

            if (!ins || ins.inserted !== true) {
              try {
                console.info("IDEMPOTENCY_SKIP", {
                  transport,
                  chatId: chatIdStr,
                  messageId: _cmdMessageId,
                  reason: "command_invocations_conflict",
                  cmd: cmdBase,
                });
              } catch (_) {}

              // STAGE 6.8.2 OBSERVABILITY (V2): reuse webhook_dedupe_events
              try {
                await insertWebhookDedupeEvent({
                  transport,
                  chatId: chatIdStr,
                  messageId: _cmdMessageId,
                  globalUserId: globalUserId || null,
                  reason: "retry_duplicate_command",
                  metadata: { handler: "command", cmd: cmdBase, stage: "6.8.2" },
                });
              } catch (e) {
                console.error(
                  "ERROR webhook_dedupe_events insert failed (command):",
                  e
                );
              }

              return; // ⛔ STOP — no side-effects
            }
          } catch (e) {
            console.error(
              "ERROR STAGE 6.8.2 command insert-first failed (fail-open):",
              e
            );
            // fail-open: continue normal flow
          }
        }

        // ✅ /start
        if (cmdBase === "/start") {
          await ctxReply(
            [
              "✅ SG online.",
              "",
              "Базовые команды:",
              "- /link_start — начать привязку identity",
              "- /link_confirm <code> — подтвердить привязку",
              "- /link_status — проверить статус",
              "",
              "ℹ️ /help — подсказка по командам (в зависимости от прав).",
            ].join("\n"),
            { cmd: cmdBase, handler: "messageRouter", event: "start" }
          );
          return;
        }

        // ✅ /help
        if (cmdBase === "/help") {
          await ctxReply(
            [
              "ℹ️ Help",
              "",
              "Базовые команды:",
              "- /link_start",
              "- /link_confirm <code> ",
              "- /link_status",
              "",
              "Dev/системные команды — только для монарха в личке.",
            ].join("\n"),
            { cmd: cmdBase, handler: "messageRouter", event: "help" }
          );
          return;
        }

        // ✅ Stage 3.5 — apply RL to ALL commands (except /start, /help). Monarch bypass.
        // NOTE Stage 11.x:
        // - router-level behavior_events logging for rate_limited removed
        // - authoritative observability now lives in core/handleMessage.js
        if (!isMonarchUser) {
          const rlKey = `${senderIdStr}:${chatIdStr}:cmd`;
          const rl = checkRateLimit({
            key: rlKey,
            windowMs: CMD_RL_WINDOW_MS,
            max: CMD_RL_MAX,
          });

          if (!rl.allowed) {
            const sec = Math.ceil(rl.retryAfterMs / 1000);

            await ctxReply(`⛔ Слишком часто. Подожди ${sec} сек.`, {
              cmd: cmdBase,
              handler: "messageRouter",
              event: "rate_limit",
              retry_after_sec: sec,
            });
            return;
          }
        }

        {
          const devGate = await devCommandGate({
            cmdBase,
            isMonarchUser,
            isPrivate,
            chatType,
            chatIdStr,
            senderIdStr,
            transportChatType,
            accessPack,
            ctxReply,
          });

          if (devGate?.handled) {
            return;
          }
        }

        // ✅ /memory_status
        if (cmdBase === "/memory_status") {
          await handleMemoryStatusCommand({
            memory,
            memDiag,
            ctxReply,
            getPublicEnvSnapshot,
            cmdBase,
          });
          return;
        }

        // ✅ /memory_diag
        if (cmdBase === "/memory_diag") {
          await handleMemoryDiagCommand({
            accessPack,
            memDiag,
            chatIdStr,
            ctxReply,
            cmdBase,
          });
          return;
        }

        // ✅ /memory_integrity
        if (cmdBase === "/memory_integrity") {
          await handleMemoryIntegrityCommand({
            memDiag,
            chatIdStr,
            ctxReply,
            cmdBase,
          });
          return;
        }

        // ✅ /memory_backfill
        if (cmdBase === "/memory_backfill") {
          await handleMemoryBackfillCommand({
            accessPack,
            memDiag,
            chatIdStr,
            rest,
            ctxReply,
            cmdBase,
          });
          return;
        }

        // ✅ NEW: /memory_user_chats — list other chats that contain rows for this user
        if (cmdBase === "/memory_user_chats") {
          await handleMemoryUserChatsCommand({
            accessPack,
            memDiag,
            ctxReply,
            cmdBase,
          });
          return;
        }

        // ✅ STAGE 4 — /chat_diag (monarch, private via DEV gate above)
        if (cmdBase === "/chat_diag") {
          await handleChatDiagCommand({
            pool,
            ctxReply,
            cmdBase,
          });
          return;
        }

        if (cmdBase === "/pm_show") {
          await handlePmShowCommand({
            handlePmShow,
            bot,
            chatId,
            rest,
            getProjectSection,
          });
          return;
        }

        if (cmdBase === "/pm_set") {
          await handlePmSetCommand({
            handlePmSet,
            bot,
            chatId,
            chatIdStr,
            rest,
            upsertProjectSection,
          });
          return;
        }

        if (cmdBase === "/build_info") {
          await handleBuildInfoCommand({
            ctxReply,
            getPublicEnvSnapshot,
            upsertProjectSection,
            cmdBase,
          });
          return;
        }

        const action = CMD_ACTION[cmdBase];

        if (
          action &&
          typeof action === "string" &&
          action.startsWith("cmd.admin.") &&
          (!isMonarchUser || (!isPrivate && false))
        ) {
          return;
        }

        if (action) {
          const allowed = await requirePermOrReply(cmdBase, { rest, identityCtx });
          if (!allowed) {
            return;
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

            // ✅ STAGE 7B — unified reply (writes assistant reply to chat_memory)
            reply: ctxReply,
          };

          await dispatchCommand(cmdBase, ctx);
          return;
        }

        switch (cmdBase) {
          case "/approve": {
            await handleApproveCommand({
              handleApprove,
              bot,
              chatId,
              rest,
            });
            return;
          }

          case "/deny": {
            await handleDenyCommand({
              handleDeny,
              bot,
              chatId,
              rest,
            });
            return;
          }

          case "/behavior_events_last": {
            await handleBehaviorEventsLastCommand({
              handleBehaviorEventsLast,
              bot,
              chatId,
              rest,
              senderIdStr,
            });
            return;
          }

          case "/chat_messages_diag": {
            await handleChatMessagesDiagCommand({
              handleChatMessagesDiag,
              bot,
              chatId,
              chatIdStr,
              senderIdStr,
              globalUserId,
              isPrivateChat: isPrivate,
            });
            return;
          }

          case "/tasks_owner_diag": {
            await handleTasksOwnerDiagCommand({
              pool,
              ctxReply,
              cmdBase,
            });
            return;
          }

          case "/demo_task": {
            await handleDemoTaskCommand({
              handleDemoTask,
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
            await handleNewTaskCommand({
              handleNewTask,
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
            await handleBtcTestTaskCommand({
              handleBtcTestTask,
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
            await handleTasksCommand({
              handleTasksList,
              bot,
              chatId,
              chatIdStr,
              getUserTasks,
              access: accessPack,
            });
            return;
          }

          case "/run_task": {
            await handleRunTaskCommand({
              handleRunTask,
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
            await handleStartTaskCommand({
              handleStartTask,
              bot,
              chatId,
              rest,
              bypass: isMonarchUser,
              updateTaskStatus,
            });
            return;
          }

          case "/stop_task": {
            await handleStopTaskCommand({
              handleStopTask,
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
            await handleStopAllCommand({
              handleStopAllTasks,
              bot,
              chatId,
              bypass: isMonarchUser,
            });
            return;
          }

          case "/run_task_cmd": {
            await handleRunTaskCmdCommand({
              handleRunTaskCmd,
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
            await handleCodeOutputStatusCommand({
              ctxReply,
              getCodeOutputMode,
              cmdBase,
            });
            return;
          }

          case "/workflow_check": {
            await handleWorkflowCheckCommand({
              handleWorkflowCheck,
              bot,
              chatId,
              rest,
              senderIdStr,
            });
            return;
          }

          case "/repo_status": {
            await handleRepoStatusCommand({
              handleRepoStatus,
              bot,
              chatId,
              senderIdStr,
            });
            return;
          }

          case "/repo_tree": {
            await handleRepoTreeCommand({
              handleRepoTree,
              bot,
              chatId,
              rest,
              senderIdStr,
            });
            return;
          }

          case "/repo_file": {
            await handleRepoFileCommand({
              handleRepoFile,
              bot,
              chatId,
              rest,
            });
            return;
          }

          case "/repo_review2": {
            await handleRepoReview2Command({
              handleRepoReview2,
              bot,
              chatId,
            });
            return;
          }

          case "/repo_search": {
            await handleRepoSearchCommand({
              handleRepoSearch,
              bot,
              chatId,
              rest,
            });
            return;
          }

          case "/repo_get": {
            await handleRepoGetCommand({
              handleRepoGet,
              bot,
              chatId,
              rest,
              senderIdStr,
            });
            return;
          }

          case "/repo_check": {
            await handleRepoCheckCommand({
              handleRepoCheck,
              bot,
              chatId,
              rest,
            });
            return;
          }

          case "/repo_analyze": {
            await handleRepoAnalyzeCommand({
              handleRepoAnalyze,
              bot,
              chatId,
              rest,
            });
            return;
          }

          case "/repo_review": {
            await handleRepoReviewCommand({
              handleRepoReview,
              bot,
              chatId,
              rest,
            });
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
            await handleRepoDiffCommand({
              handleRepoDiff,
              bot,
              chatId,
              rest,
            });
            return;
          }

          case "/ar_list": {
            await handleArListCommand({
              handleArList,
              bot,
              chatId,
              rest,
            });
            return;
          }

          case "/file_logs": {
            await handleFileLogsCommand({
              handleFileLogs,
              bot,
              chatId,
              chatIdStr,
              rest,
            });
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

              // ✅ STAGE 7B — unified reply
              reply: ctxReply,
            });
            return;
          }

          // ✅ NEW: /recall (routes into commandDispatcher)
          case "/recall": {
            await dispatchCommand(cmdBase, {
              bot,
              msg,
              identityCtx,
              chatId,
              chatIdStr,
              senderIdStr,
              chatType,
              isPrivateChat: isPrivate,
              rest,
              userRole,
              userPlan,
              user,
              bypass: isMonarchUser,

              // ✅ STAGE 7B — unified reply
              reply: ctxReply,
            });
            return;
          }

          case "/sources": {
            await handleSourcesCommand({
              handleSourcesList,
              bot,
              chatId,
              chatIdStr,
              getAllSourcesSafe,
              formatSourcesList,
            });
            return;
          }

          case "/sources_diag": {
            await handleSourcesDiagCommand({
              handleSourcesDiag,
              bot,
              chatId,
              chatIdStr,
              rest,
              runSourceDiagnosticsOnce,
            });
            return;
          }

          case "/source": {
            await handleSourceCommand({
              handleSource,
              bot,
              chatId,
              chatIdStr,
              rest,
              fetchFromSourceKey,
            });
            return;
          }

          case "/diag_source": {
            await handleDiagSourceCommand({
              handleDiagSource,
              bot,
              chatId,
              chatIdStr,
              rest,
              diagnoseSource,
            });
            return;
          }

          case "/test_source": {
            await handleTestSourceCommand({
              handleTestSource,
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

      // ✅ FIX: router MUST provide real memory writers for chat.js,
      // otherwise core shadow can write only user (MEMORY_SHADOW_WRITE) => u=1 a=0.
      // NOTE: memory already created above (Stage 7B) — keep local name for clarity.

      const { saveMessageToMemory, saveChatPair } = createChatMemoryWriters({
        memory,
        msg,
        globalUserId,
        forcePairMessageId,
      });

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

        // read-only
        getChatHistory,
        // ✅ write enabled (router provides writers)
        saveMessageToMemory,
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