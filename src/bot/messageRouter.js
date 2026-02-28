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

// ✅ Stage 3.5 — RateLimit (V1)
import { checkRateLimit } from "./rateLimiter.js";

// ✅ Stage 3.6 — Config hygiene (V1)
import { envIntRange, envStr, getPublicEnvSnapshot } from "../core/config.js";

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

      // =========================================================================
      // STAGE 6 — Transport skeleton wiring (NO behavior change)
      // =========================================================================
      // eslint/linters may complain about unused import; read once (no side-effects beyond env read)
      const _transportEnforced = isTransportEnforced();
      void _transportEnforced;

      // ✅ Stage 6.6 — trace flag exists in transportConfig; read once for lint/clarity
      const _transportTraceEnabled = isTransportTraceEnabled();
      void _transportTraceEnabled;

      const telegramAdapterContext = createUnifiedContext({
        transport: "telegram",
        chatId: chatIdStr,
        senderId: senderIdStr,
        chatType: transportChatTypeRaw,
        isPrivate,
        text: trimmed,
        raw: msg,
      });

      const coreContextFromTransport = toCoreContextFromUnified(
        telegramAdapterContext,
        {
          messageId: msg.message_id,
          globalUserId,
          transportChatTypeOverride: transportChatTypeRaw,
        }
      );

      // ✅ STAGE 6 — trace only (under TRACE flag), NO behavior change
      // IMPORTANT:
      // - Must NOT call handleMessageCore() second time
      // - Log should be minimal (no full text dump) to avoid leaking payloads
      if (isTransportTraceEnabled()) {
        try {
          const trace = {
            transport: coreContextFromTransport?.transport || null,
            chatId: coreContextFromTransport?.chatId || null,
            senderId: coreContextFromTransport?.senderId || null,
            transportChatType: coreContextFromTransport?.transportChatType || null,
            messageId: coreContextFromTransport?.messageId || null,
            globalUserId: coreContextFromTransport?.globalUserId || null,
            textLen:
              typeof coreContextFromTransport?.text === "string"
                ? coreContextFromTransport.text.length
                : 0,
          };
          console.log("[TRANSPORT_TRACE] coreContextFromTransport:", trace);
        } catch (e) {
          // swallow
        }
      }

      // ✅ STAGE 6.8 — SHADOW uses transport-built core context (single path)
      // Goal:
      // - Always use coreContextFromTransport for the shadow call.
      // - Keep old Stage 6.7 branch as fallback-only to respect "no deletions".
      // - Never block Telegram flow.
      let __shadowWasHandledByTransport = false;
            // ✅ TEST ONLY: force transport-shadow failure to verify fallback logging
      // Enable briefly via Render env: TRANSPORT_FORCE_FALLBACK=true
      if (String(process.env.TRANSPORT_FORCE_FALLBACK || "").trim().toLowerCase() === "true") {
        throw new Error("TRANSPORT_FORCE_FALLBACK");
      }
      
      try {
        await handleMessageCore(coreContextFromTransport);
        __shadowWasHandledByTransport = true;
      } catch (e) {
        console.error("handleMessageCore(SHADOW_TRANSPORT_V1) failed:", e);
      }

      // NOTE:
      // - NOT used yet as main flow
      // - Existing fallback shadow call below remains only if transport-shadow fails
      // - Future switch will use isTransportEnforced()

      if (!__shadowWasHandledByTransport) {
        if (isTransportTraceEnabled()) {
          console.warn("[TRANSPORT_FALLBACK] legacy shadow activated");
        }

        // ✅ STAGE 6.7 — enforced routing SKELETON (fallback-only)
        // Goal:
        // - Prepare branch for "enforced routing" WITHOUT switching the real reply flow.
        // - When TRANSPORT_ENFORCED=true, we ONLY change the SHADOW input context source
        //   to the transport-built coreContextFromTransport.
        // - We DO NOT early-return and we DO NOT call handleMessageCore twice.
        const __useEnforcedShadowContext = isTransportEnforced() === true;

        if (__useEnforcedShadowContext) {
          // ✅ STAGE 6.7: SHADOW (enforced context) — still shadow-only, router remains authoritative
          try {
            await handleMessageCore(coreContextFromTransport);
          } catch (e) {
            // Never block Telegram flow on Stage 6 skeleton
            console.error("handleMessageCore(SHADOW_ENFORCED) failed:", e);
          }
        } else {
          // ✅ STAGE 6 shadow wiring: call core handleMessage(context) WITHOUT affecting replies
          // ✅ STAGE 6.6: DO NOT pass derived chatType/isPrivateChat from router into core
          try {
            await handleMessageCore({
              transport: "telegram",
              chatId: chatIdStr,
              senderId: senderIdStr,
              transportChatType, // raw-ish transport hint; core derives chat meta
              text: trimmed,
              messageId: msg.message_id, // ✅ STAGE 7.2 — activate memory shadow
              globalUserId,
            });
          } catch (e) {
            // Never block Telegram flow on Stage 6 skeleton
            console.error("handleMessageCore(SHADOW) failed:", e);
          }
        }
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

        // ✅ /start
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

        // ✅ /help
        if (cmdBase === "/help") {
          await bot.sendMessage(
            chatId,
            [
              "ℹ️ Help",
              "",
              "Базовые команды:",
              "- /link_start",
              "- /link_confirm <code> ",
              "- /link_status",
              "",
              "Dev/системные команды — только для монарха в личке.",
            ].join("\n")
          );
          return;
        }

        // ✅ Stage 3.5 — apply RL to ALL commands (except /start, /help). Monarch bypass.
        if (!isMonarchUser) {
          const rlKey = `${senderIdStr}:${chatIdStr}:cmd`;
          const rl = checkRateLimit({
            key: rlKey,
            windowMs: CMD_RL_WINDOW_MS,
            max: CMD_RL_MAX,
          });

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

          // ✅ STAGE 4.3 — Chat Gate admin (DEV-only)
          "/chat_on",
          "/chat_off",
          "/chat_status",

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
          "/chat_diag", // ✅ STAGE 4 — minimal diag
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

          const pub = getPublicEnvSnapshot();
          const buildCommit =
            String(pub.RENDER_GIT_COMMIT || "").trim() ||
            String(pub.GIT_COMMIT || "").trim() ||
            "";
          const buildService = String(pub.RENDER_SERVICE_ID || "").trim();
          const buildInstance =
            String(pub.RENDER_INSTANCE_ID || "").trim() ||
            String(pub.HOSTNAME || "").trim();

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
              "ENV (public allowlist):",
              `MEMORY_ENABLED: ${String(pub.MEMORY_ENABLED || "")}`,
              `MEMORY_MODE: ${String(pub.MEMORY_MODE || "")}`,
              `NODE_ENV: ${String(pub.NODE_ENV || "")}`,
              "",
              "BUILD:",
              `commit: ${buildCommit}`,
              `service: ${buildService}`,
              `instance: ${buildInstance}`,
            ].join("\n")
          );

          return;
        }

        // ✅ /memory_diag
        if (cmdBase === "/memory_diag") {
          const globalUserId2 =
            accessPack?.user?.global_user_id || accessPack?.global_user_id || null;
          const out = await memDiag.memoryDiag({
            chatIdStr,
            globalUserId: globalUserId2,
          });
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
          const globalUserId2 =
            accessPack?.user?.global_user_id || accessPack?.global_user_id || null;
          const rawN = Number(String(rest || "").trim() || "200");
          const limit = Number.isFinite(rawN)
            ? Math.max(1, Math.min(500, rawN))
            : 200;

          const out = await memDiag.memoryBackfill({
            chatIdStr,
            globalUserId: globalUserId2,
            limit,
          });
          await bot.sendMessage(chatId, out);
          return;
        }

        // ✅ NEW: /memory_user_chats — list other chats that contain rows for this user
        if (cmdBase === "/memory_user_chats") {
          const globalUserId2 =
            accessPack?.user?.global_user_id || accessPack?.global_user_id || null;
          const out = await memDiag.memoryUserChats({ globalUserId: globalUserId2 });
          await bot.sendMessage(chatId, out);
          return;
        }

        // ✅ STAGE 4 — /chat_diag (monarch, private via DEV gate above)
        if (cmdBase === "/chat_diag") {
          try {
            const chatsCountRes = await pool.query(
              `SELECT COUNT(*)::int AS n FROM chats`
            );
            const linksCountRes = await pool.query(
              `SELECT COUNT(*)::int AS n FROM user_chat_links`
            );

            const lastChatRes = await pool.query(
              `
              SELECT chat_id, transport, chat_type, title, updated_at, last_seen_at
              FROM chats
              ORDER BY updated_at DESC NULLS LAST
              LIMIT 1
              `
            );

            const lastLinkRes = await pool.query(
              `
              SELECT global_user_id, chat_id, transport, created_at, last_seen_at
              FROM user_chat_links
              ORDER BY COALESCE(last_seen_at, created_at) DESC NULLS LAST
              LIMIT 1
              `
            );

            // ✅ NEW: last 5 chats/links (compact listing)
            const lastChatsRes = await pool.query(
              `
              SELECT chat_id, transport, chat_type, title, updated_at, last_seen_at
              FROM chats
              ORDER BY updated_at DESC NULLS LAST
              LIMIT 5
              `
            );

            const lastLinksRes = await pool.query(
              `
              SELECT global_user_id, chat_id, transport, created_at, last_seen_at
              FROM user_chat_links
              ORDER BY COALESCE(last_seen_at, created_at) DESC NULLS LAST
              LIMIT 5
              `
            );

            const chatsTotal = chatsCountRes.rows?.[0]?.n ?? 0;
            const linksTotal = linksCountRes.rows?.[0]?.n ?? 0;

            const lc = lastChatRes.rows?.[0] || null;
            const ll = lastLinkRes.rows?.[0] || null;

            const lastChats = lastChatsRes.rows || [];
            const lastLinks = lastLinksRes.rows || [];

            const fmtTs = (v) => (v ? new Date(v).toISOString() : "—");

            const out = [];
            out.push("🧩 CHAT DIAG");
            out.push(`chats_total: ${chatsTotal}`);
            out.push(`links_total: ${linksTotal}`);
            out.push("");

            out.push("last_chat:");
            if (!lc) {
              out.push("—");
            } else {
              out.push(
                [
                  `chat_id=${lc.chat_id}`,
                  `transport=${lc.transport || "—"}`,
                  `type=${lc.chat_type || "—"}`,
                  `title=${lc.title || "—"}`,
                  `updated_at=${fmtTs(lc.updated_at)}`,
                  `last_seen_at=${fmtTs(lc.last_seen_at)}`,
                ].join(" | ")
              );
            }

            out.push("");
            out.push("last_link:");
            if (!ll) {
              out.push("—");
            } else {
              out.push(
                [
                  `global_user_id=${ll.global_user_id}`,
                  `chat_id=${ll.chat_id}`,
                  `transport=${ll.transport || "—"}`,
                  `created_at=${fmtTs(ll.created_at)}`,
                  `last_seen_at=${fmtTs(ll.last_seen_at)}`,
                ].join(" | ")
              );
            }

            out.push("");
            out.push("last_5_chats:");
            if (!lastChats.length) {
              out.push("—");
            } else {
              let i = 0;
              for (const r of lastChats) {
                i += 1;
                out.push(
                  [
                    `${i})`,
                    `chat_id=${r.chat_id}`,
                    `type=${r.chat_type || "—"}`,
                    `title=${r.title || "—"}`,
                    `updated_at=${fmtTs(r.updated_at)}`,
                    `last_seen_at=${fmtTs(r.last_seen_at)}`,
                  ].join(" ")
                );
              }
            }

            out.push("");
            out.push("last_5_links:");
            if (!lastLinks.length) {
              out.push("—");
            } else {
              let i = 0;
              for (const r of lastLinks) {
                i += 1;
                out.push(
                  [
                    `${i})`,
                    `global_user_id=${r.global_user_id}`,
                    `chat_id=${r.chat_id}`,
                    `created_at=${fmtTs(r.created_at)}`,
                    `last_seen_at=${fmtTs(r.last_seen_at)}`,
                  ].join(" ")
                );
              }
            }

            await bot.sendMessage(chatId, out.join("\n").slice(0, 3800));
          } catch (e) {
            console.error("❌ /chat_diag error:", e);
            await bot.sendMessage(
              chatId,
              "⚠️ /chat_diag упал. Проверь: применена ли миграция 027 (таблицы chats и user_chat_links)."
            );
          }
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
          const pub = getPublicEnvSnapshot();

          const commit =
            String(pub.RENDER_GIT_COMMIT || "").trim() ||
            String(pub.GIT_COMMIT || "").trim() ||
            "unknown";

          const serviceId = String(pub.RENDER_SERVICE_ID || "").trim() || "unknown";

          const instanceId =
            String(pub.RENDER_INSTANCE_ID || "").trim() ||
            String(pub.HOSTNAME || "").trim() ||
            "unknown";

          const nodeEnv = String(pub.NODE_ENV || "").trim() || "unknown";
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

        const action = CMD_ACTION[cmdBase];

        if (
          action &&
          typeof action === "string" &&
          action.startsWith("cmd.admin.") &&
          (!isMonarchUser || (!isPrivate && !devAllowInGroup))
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
              lines.push(
                `has tasks.user_global_id: ${hasUserGlobalId ? "YES" : "NO"}`
              );
              lines.push(`total tasks: ${s.total ?? 0}`);
              if (hasUserGlobalId)
                lines.push(`missing user_global_id: ${s.global_id_missing ?? 0}`);
              lines.push("");
              lines.push("Last 20 tasks:");

              for (const r of rows) {
                const created = r.created_at
                  ? new Date(r.created_at).toISOString()
                  : "—";
                const lastRun = r.last_run
                  ? new Date(r.last_run).toISOString()
                  : "—";
                if (hasUserGlobalId) {
                  lines.push(
                    `#${r.id} | ${r.type} | ${r.status} | global=${
                      r.user_global_id || "—"
                    } | created=${created} | last_run=${lastRun}`
                  );
                } else {
                  lines.push(
                    `#${r.id} | ${r.type} | ${r.status} | created=${created} | last_run=${lastRun}`
                  );
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

      // ✅ STAGE 7.3: router must NOT write memory anymore (core does it).
      // Keep no-op writers to avoid breaking handler signature if it still calls them.
      const saveMessageToMemory = async () => {};
      const saveChatPair = async () => {};

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
        // write disabled (core owns writes)
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
