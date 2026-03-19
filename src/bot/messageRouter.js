// ============================================================================
// === src/bot/messageRouter.js — MAIN HANDLER extracted from index.js ===
// ============================================================================

import { handleCodeFullfile } from "./handlers/codeFullfile.js";
import { handleCodeInsert } from "./handlers/codeInsert.js";
import { handleRepoDiff } from "./handlers/repoDiff.js";
import { CMD_ACTION } from "./cmdActionMap.js";
import { handleChatMessage } from "./handlers/chat.js";

// ✅ Stage 5.3: workflow check

import pool from "../../db.js";

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

// ✅ Project Memory service (read)
import {
  getProjectSection,
  getProjectMemoryList,
} from "../../projectMemory.js";

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
import { handleRepoDiffCommand } from "./router/repoDiffCommand.js";
import { handleProjectMemoryCommands } from "./router/projectMemoryCommands.js";
import { handleTaskExecutionCommands } from "./router/taskExecutionCommands.js";
import { handleSourceDomainCommands } from "./router/sourceDomainCommands.js";
import { handleRepoDomainCommands } from "./router/repoDomainCommands.js";
import { handleMiscDiagnosticsCommands } from "./router/miscDiagnosticsCommands.js";
import { handleTaskListCommands } from "./router/taskListCommands.js";
import { handleContextDebugCommands } from "./router/contextDebugCommands.js";
import { handleMemoryDiagnosticsCommands } from "./router/memoryDiagnosticsCommands.js";
import { handleBasicPublicCommands } from "./router/basicPublicCommands.js";
import {
  handleUtilityStatusEarlyCommands,
  handleUtilityStatusLateCommands,
} from "./router/utilityStatusCommands.js";
import { bootstrapRouterIdentityAndLinks } from "./router/identityBootstrap.js";

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

      const MONARCH_USER_ID = envStr("MONARCH_USER_ID", "").trim();
      const isMonarchFn = (idStr) => String(idStr || "") === MONARCH_USER_ID;

      const {
        identityCtx,
        accessPack,
        globalUserId,
        isMonarchUser,
      } = await bootstrapRouterIdentityAndLinks({
        msg,
        chatIdStr,
        senderIdStr,
        chatType,
        isPrivate,
        isMonarchFn,
        chatGateMode: CHAT_GATE_MODE,
        chatDefaultActive: CHAT_DEFAULT_ACTIVE,
      });

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

              return;
            }
          } catch (e) {
            console.error(
              "ERROR STAGE 6.8.2 command insert-first failed (fail-open):",
              e
            );
          }
        }

        {
          const handledBasicPublic = await handleBasicPublicCommands({
            cmdBase,
            ctxReply,
          });

          if (handledBasicPublic) {
            return;
          }
        }

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

        {
          const handledMemoryDiagnostics =
            await handleMemoryDiagnosticsCommands({
              cmdBase,
              memory,
              memDiag,
              accessPack,
              chatIdStr,
              rest,
              ctxReply,
              getPublicEnvSnapshot,
              pool,
            });

          if (handledMemoryDiagnostics) {
            return;
          }
        }

        {
          const handledProjectMemory = await handleProjectMemoryCommands({
            cmdBase,
            bot,
            chatId,
            chatIdStr,
            rest,
            getProjectSection,
            upsertProjectSection,
            getProjectMemoryList,
          });

          if (handledProjectMemory) {
            return;
          }
        }

        {
          const handledUtilityStatusEarly =
            await handleUtilityStatusEarlyCommands({
              cmdBase,
              ctxReply,
              getPublicEnvSnapshot,
              upsertProjectSection,
            });

          if (handledUtilityStatusEarly) {
            return;
          }
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

            reply: ctxReply,
          };

          await dispatchCommand(cmdBase, ctx);
          return;
        }

        {
          const handledMiscDiagnostics = await handleMiscDiagnosticsCommands({
            cmdBase,
            bot,
            chatId,
            chatIdStr,
            rest,
            senderIdStr,
            globalUserId,
            isPrivate,
            pool,
            ctxReply,
          });

          if (handledMiscDiagnostics) {
            return;
          }
        }

        {
          const handledTaskList = await handleTaskListCommands({
            cmdBase,
            bot,
            chatId,
            chatIdStr,
            rest,
            accessPack,
            createDemoTask,
            createManualTask,
            createTestPriceMonitorTask,
            getUserTasks,
          });

          if (handledTaskList) {
            return;
          }
        }

        {
          const handledTaskExecution = await handleTaskExecutionCommands({
            cmdBase,
            bot,
            chatId,
            chatIdStr,
            rest,
            access: accessPack,
            getTaskById,
            runTaskWithAI,
            bypass: isMonarchUser,
            updateTaskStatus,
            userRole,
          });

          if (handledTaskExecution) {
            return;
          }
        }

        {
          const handledUtilityStatusLate = await handleUtilityStatusLateCommands({
            cmdBase,
            ctxReply,
            bot,
            chatId,
            rest,
            senderIdStr,
          });

          if (handledUtilityStatusLate) {
            return;
          }
        }

        {
          const handledRepoDomain = await handleRepoDomainCommands({
            cmdBase,
            bot,
            chatId,
            rest,
            senderIdStr,
          });

          if (handledRepoDomain) {
            return;
          }
        }

        switch (cmdBase) {
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

          default: {
            break;
          }
        }

        {
          const handledContextDebug = await handleContextDebugCommands({
            cmdBase,
            bot,
            msg,
            identityCtx,
            chatId,
            chatIdStr,
            senderIdStr,
            chatType,
            isPrivate,
            rest,
            userRole,
            userPlan,
            user,
            isMonarchUser,
            ctxReply,
          });

          if (handledContextDebug) {
            return;
          }
        }

        {
          const handledSourceDomain = await handleSourceDomainCommands({
            cmdBase,
            bot,
            chatId,
            rest,
            userRole,
            userPlan,
            bypass: isMonarchUser,
          });

          if (handledSourceDomain) {
            return;
          }
        }

        return;
      }

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

        getChatHistory,
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