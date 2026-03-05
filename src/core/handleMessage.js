// src/core/handleMessage.js
// STAGE 6.4 — handleMessage(context) — Core entrypoint for any transport.
//
// IMPORTANT:
// - Shadow-wired when deps.reply / deps.callAI are not provided.
// - When deps are provided (enforced mode), this function produces real replies.
// - Transport must be THIN: all routing here, not in adapter.

import { deriveChatMeta } from "./transportMeta.js";
import { isTransportTraceEnabled } from "../transport/transportConfig.js";
import { getMemoryService } from "./memoryServiceFactory.js";

// ✅ STAGE 7B — chat_messages logging for COMMANDS (Core-level; Transport stays thin)
import { insertUserMessage, insertAssistantMessage } from "../db/chatMessagesRepo.js";
import { redactText, sha256Text, buildRawMeta } from "./redaction.js";

// ✅ STAGE 6 LOGIC — Access + Identity
import { resolveUserAccess } from "../users/userAccess.js";
import { ensureUserProfile } from "../users/userProfile.js";
import { can } from "../users/permissions.js";
import { envStr, envIntRange } from "./config.js";

// ✅ STAGE 6 LOGIC — Routing helpers
import { CMD_ACTION } from "../bot/cmdActionMap.js";
import { parseCommand } from "../../core/helpers.js";

// ✅ STAGE 3.5 — RateLimit
import { checkRateLimit } from "../bot/rateLimiter.js";

// ✅ STAGE 5.16 — Behavior events (observability)
import { BehaviorEventsService } from "../logging/BehaviorEventsService.js";
const behaviorEvents = new BehaviorEventsService();

// ✅ STAGE 6.8.2 — command idempotency (core-level)
import { insertCommandInvocation } from "../db/commandInvocationsRepo.js";

// ============================================================================
// Stage 3.5: COMMAND RATE-LIMIT (in-memory, per instance)
// ============================================================================
const CMD_RL_WINDOW_MS = envIntRange("CMD_RL_WINDOW_MS", 20000, {
  min: 1000,
  max: 300000,
});
const CMD_RL_MAX = envIntRange("CMD_RL_MAX", 6, { min: 1, max: 50 });

function envBool(name, def = false) {
  const v = envStr(name, def ? "true" : "false").trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return def;
}

// ============================================================================
// STAGE 8D — Idempotency (chat): in-memory dedupe for enforced mode
// Purpose: drop duplicate deliveries (Telegram retries, webhook replays).
// No DB, no schema changes. TTL-based. Does NOT survive process restart.
// ============================================================================
const DEDUPE_TTL_MS = envIntRange("DEDUPE_TTL_MS", 5 * 60 * 1000, {
  min: 1000,
  max: 60 * 60 * 1000,
});
const DEDUPE_MAX = envIntRange("DEDUPE_MAX", 5000, { min: 100, max: 50000 });

// key -> lastSeenTs
const __dedupeSeen = new Map();

function dedupeSeenHasFresh(key, now) {
  if (!key) return false;
  const ts = __dedupeSeen.get(key);
  if (!ts) return false;
  return now - ts <= DEDUPE_TTL_MS;
}

function dedupeRemember(key, now) {
  if (!key) return;
  __dedupeSeen.set(key, now);

  // cheap pruning to keep Map bounded
  if (__dedupeSeen.size <= DEDUPE_MAX) return;

  const cutoff = now - DEDUPE_TTL_MS;
  for (const [k, ts] of __dedupeSeen.entries()) {
    if (ts < cutoff) __dedupeSeen.delete(k);
    if (__dedupeSeen.size <= DEDUPE_MAX) break;
  }

  // still too big: drop oldest approx (iteration order == insertion order)
  while (__dedupeSeen.size > DEDUPE_MAX) {
    const oldestKey = __dedupeSeen.keys().next().value;
    __dedupeSeen.delete(oldestKey);
  }
}

export async function handleMessage(context = {}) {
  const transport = String(context?.transport || "unknown");
  const chatId = context?.chatId == null ? null : String(context.chatId);
  const senderId = context?.senderId == null ? null : String(context.senderId);
  const text = context?.text == null ? "" : String(context.text);
  const messageId = context?.messageId == null ? null : String(context.messageId);

  // deps — injected by adapter for real mode; absent in shadow mode
  const deps = context?.deps || null;
  const hasReply = typeof deps?.reply === "function";
  const hasCallAI = typeof deps?.callAI === "function";
  const isEnforced = hasReply && hasCallAI;

  let globalUserId = context?.globalUserId == null ? null : String(context.globalUserId);

  const derived = deriveChatMeta({
    transport,
    chatId,
    senderId,
    transportChatType: context?.transportChatType ?? context?.chatType ?? null,
  });

  const chatType = derived.chatType || null;
  const isPrivateChat =
    typeof context?.isPrivateChat === "boolean" ? context.isPrivateChat : derived.isPrivateChat;

  // STAGE 7B — shared constants/helpers (match handlers/chat.js policy)
  const MAX_CHAT_MESSAGE_CHARS = 16000;

  const truncateForDb = (s) => {
    const t = typeof s === "string" ? s : String(s ?? "");
    if (t.length <= MAX_CHAT_MESSAGE_CHARS) return { text: t, truncated: false };
    return { text: t.slice(0, MAX_CHAT_MESSAGE_CHARS), truncated: true };
  };

  // =========================================================================
  // STAGE 6.8 — Enforced guard: no processing without dedupe key/messageId
  // =========================================================================
  if (isEnforced) {
    const dedupeKey = context?.dedupeKey || null;
    if (!dedupeKey || !messageId) {
      try {
        if (isTransportTraceEnabled()) {
          console.warn("ENFORCED_DROP_NO_DEDUPE", {
            transport,
            chatId,
            senderId,
            messageId,
            dedupeKey,
          });
        }
      } catch (_) {}
      return { ok: false, reason: "missing_dedupeKey", stage: "6.8" };
    }

    // =========================================================================
    // STAGE 8D — In-memory dedupe drop (prevents double-processing + double-reply)
    // =========================================================================
    try {
      const now = Date.now();
      const key = String(dedupeKey);

      if (dedupeSeenHasFresh(key, now)) {
        if (isTransportTraceEnabled()) {
          console.warn("ENFORCED_DROP_DUPLICATE", {
            transport,
            chatId,
            senderId,
            messageId,
            dedupeKey: key,
          });
        }
        return { ok: true, stage: "8D", result: "dup_drop" };
      }

      dedupeRemember(key, now);
    } catch (e) {
      // fail-open: never block processing because of dedupe errors
      try {
        console.error("dedupe guard failed (fail-open):", e);
      } catch (_) {}
    }
  }

  // =========================================================================
  // STAGE 6 LOGIC STEP 1 — Identity + Access
  // =========================================================================
  let accessPack = null;
  let userRole = "guest";
  let userPlan = "free";
  let user = { role: "guest", plan: "free", global_user_id: null };

  if (transport === "telegram" && senderId) {
    try {
      if (context?.raw && typeof context.raw === "object") {
        await ensureUserProfile(context.raw);
      }
    } catch (e) {
      console.error("handleMessage(ensureUserProfile) failed:", e);
    }

    try {
      const MONARCH_USER_ID = envStr("MONARCH_USER_ID", "").trim();
      const isMonarchFn = (id) => String(id || "") === MONARCH_USER_ID;

      accessPack = await resolveUserAccess({
        senderIdStr: senderId,
        isMonarch: isMonarchFn,
        provider: transport,
      });

      userRole = accessPack?.userRole || "guest";
      userPlan = accessPack?.userPlan || "free";
      user = accessPack?.user || user;

      if (!globalUserId && user?.global_user_id) {
        globalUserId = user.global_user_id;
      }
    } catch (e) {
      console.error("handleMessage(resolveUserAccess) failed:", e);
    }
  }

  const isMonarchUser = userRole === "monarch";

  // =========================================================================
  // STAGE 6 LOGIC STEP 2 — Routing
  // =========================================================================
  const trimmed = text.trim();
  const isCommand = trimmed.startsWith("/");
  const parsed = isCommand ? parseCommand(trimmed) : null;
  const cmdBase = parsed ? String(parsed.cmd).split("@")[0] : null;
  const rest = parsed?.rest || "";

  // Permission check for commands
  let canProceed = true;
  if (isCommand && cmdBase) {
    const action = CMD_ACTION[cmdBase];
    if (action) {
      canProceed = can(user, action);
    }
  }

  // =========================================================================
  // Trace log
  // =========================================================================
  try {
    if (isTransportTraceEnabled()) {
      console.log("📨 handleMessage(core)", {
        transport,
        chatId,
        senderId,
        globalUserId,
        chatType,
        isPrivateChat,
        isMonarchUser,
        userRole,
        isCommand,
        cmdBase,
        canProceed,
        isEnforced,
      });
    }
  } catch {
    // ignore
  }

  // =========================================================================
  // STAGE 7.1 — Memory shadow write (OFF by default)
  // =========================================================================
  try {
    const memory = getMemoryService();
    const enabled = Boolean(memory?.config?.enabled);
    const shadowWriteEnabled = envBool("MEMORY_SHADOW_WRITE", false);

    if (!isEnforced && enabled && shadowWriteEnabled && chatId && messageId && text) {
      await memory.write({
        chatId,
        globalUserId: globalUserId || null,
        role: "user",
        content: text,
        transport,
        metadata: {
          messageId,
          source: "core.handleMessage.shadow",
          chatType,
          isPrivateChat,
        },
        schemaVersion: 2,
      });
    }
  } catch (e) {
    console.error("handleMessage(memory shadow) failed:", e);
  }

  // =========================================================================
  // Shadow mode: compute routing but don't act
  // =========================================================================
  if (!isEnforced) {
    return {
      ok: true,
      stage: "6.shadow",
      note: "routing computed (shadow). deps not provided — no reply.",
      transport,
      userRole,
      isMonarchUser,
      isCommand,
      cmdBase,
      canProceed,
    };
  }

  // =========================================================================
  // ENFORCED MODE — real routing + reply
  // =========================================================================
  const chatIdNum = chatId ? Number(chatId) : null;
  const chatIdStr = chatId || "";

  if (!chatIdNum) {
    return { ok: false, reason: "missing_chatId" };
  }

  // ✅ STAGE 7B — Core reply wrapper: always fail-open
  const replyAndLog = async (message, meta = {}) => {
    const out = String(message ?? "");
    try {
      await deps.reply(context, out);
    } catch (e) {
      console.error("replyAndLog: deps.reply failed:", e);
    }

    try {
      const red = redactText(out);
      const { text: content, truncated } = truncateForDb(red);
      const textHash = sha256Text(red);

      await insertAssistantMessage({
        transport,
        chatId: chatIdStr,
        chatType,
        globalUserId: globalUserId || null,
        textHash,
        content,
        truncated,
        metadata: {
          ...meta,
          stage: "7B.command.reply",
          cmd: meta?.cmd || null,
          senderId,
          chatId: chatIdStr,
          messageId: messageId ? Number(messageId) : null,
        },
        schemaVersion: 1,
      });
    } catch (e) {
      console.error("replyAndLog: insertAssistantMessage failed (fail-open):", e);
    }
  };

  // --- COMMAND ROUTING ---
  if (isCommand && cmdBase) {
    // STAGE 6.8.2 — command idempotency (core-level, enforced path)
    let commandInvocationInserted = true;
    try {
      if (transport === "telegram" && chatIdStr && messageId) {
        const ins = await insertCommandInvocation({
          transport,
          chatId: chatIdStr,
          messageId: Number(messageId),
          cmd: cmdBase,
          globalUserId: globalUserId || null,
          senderId: senderId || "",
          metadata: { enforced: true, source: "core.handleMessage" },
        });

        if (!ins?.inserted) {
          commandInvocationInserted = false;
          return { ok: true, stage: "6.8.2", result: "dup_command_drop", cmdBase };
        }
      }
    } catch (e) {
      console.error("core command idempotency guard failed:", e);
      // fail-open
      commandInvocationInserted = true;
    }

    // ✅ STAGE 7B — log inbound COMMAND as user message into chat_messages (fail-open)
    // (only after command idempotency accepted; avoids duplicate user rows on retries)
    try {
      if (commandInvocationInserted && transport === "telegram" && chatIdStr && messageId) {
        const red = redactText(trimmed);
        const { text: content, truncated } = truncateForDb(red);
        const textHash = sha256Text(red);

        await insertUserMessage({
          transport,
          chatId: chatIdStr,
          chatType,
          globalUserId: globalUserId || null,
          senderId: senderId || null,
          messageId: Number(messageId),
          textHash,
          content,
          truncated,
          metadata: {
            stage: "7B.command.in",
            cmd: cmdBase,
            senderId,
            chatId: chatIdStr,
            messageId: Number(messageId),
          },
          raw: buildRawMeta(context?.raw || {}),
          schemaVersion: 1,
        });
      }
    } catch (e) {
      console.error("STAGE 7B command insertUserMessage failed (fail-open):", e);
    }

    // Stage 3.5 — apply RL to ALL commands (except /start, /help). Monarch bypass.
    if (!isMonarchUser && cmdBase !== "/start" && cmdBase !== "/help") {
      const rlKey = `${senderId || ""}:${chatIdStr}:cmd`;
      const rl = checkRateLimit({
        key: rlKey,
        windowMs: CMD_RL_WINDOW_MS,
        max: CMD_RL_MAX,
      });

      if (!rl.allowed) {
        // behavior_events: rate_limited
        try {
          await behaviorEvents.logEvent({
            globalUserId: globalUserId || null,
            chatId: chatIdStr,
            transport,
            eventType: "rate_limited",
            metadata: {
              cmd: cmdBase,
              windowMs: CMD_RL_WINDOW_MS,
              max: CMD_RL_MAX,
              senderId: senderId || null,
            },
            schemaVersion: 1,
          });
        } catch (e) {
          console.error("handleMessage(rate_limited logEvent) failed:", e);
        }

        const sec = Math.ceil(rl.retryAfterMs / 1000);
        await replyAndLog(`⛔ Слишком часто. Подожди ${sec} сек.`, {
          cmd: cmdBase,
          event: "rate_limited",
        });
        return { ok: true, stage: "3.5", result: "rate_limited", cmdBase };
      }
    }

    if (!canProceed) {
      // behavior_events: permission_denied
      try {
        await behaviorEvents.logEvent({
          globalUserId: globalUserId || null,
          chatId: chatIdStr,
          transport,
          eventType: "permission_denied",
          metadata: {
            cmd: cmdBase,
            userRole,
            userPlan,
            senderId: senderId || null,
          },
          schemaVersion: 1,
        });
      } catch (e) {
        console.error("handleMessage(permission_denied logEvent) failed:", e);
      }

      await replyAndLog("⛔ Недостаточно прав.", {
        cmd: cmdBase,
        event: "permission_denied",
      });
      return { ok: true, stage: "6.logic.2", result: "permission_denied", cmdBase };
    }

    if (typeof deps?.dispatchCommand === "function") {
      try {
        const dispatchCtx = {
          bot: deps.bot || null,
          chatId: chatIdNum,
          chatIdStr,
          senderIdStr: senderId || "",
          rest,
          user,
          userRole,
          userPlan,
          bypass: isMonarchUser,

          // ✅ reply that logs assistant output into chat_messages (Stage 7B)
          reply: async (text, meta = {}) => replyAndLog(text, { cmd: cmdBase, ...meta }),

          // extra useful context
          globalUserId,
          transport,
          chatType,
          messageId: messageId ? Number(messageId) : null,

          isPrivateChat,
          identityCtx: {
            transport,
            senderIdStr: senderId || "",
            chatIdStr,
            chatType,
            isPrivateChat,
            isMonarchUser,
          },
          getAnswerMode: deps.getAnswerMode,
          setAnswerMode: deps.setAnswerMode,
          callAI: deps.callAI,
          logInteraction: deps.logInteraction,
          getCoinGeckoSimplePriceById: deps.getCoinGeckoSimplePriceById,
          getCoinGeckoSimplePriceMulti: deps.getCoinGeckoSimplePriceMulti,
          getUserTasks: deps.getUserTasks,
          getTaskById: deps.getTaskById,
          runTaskWithAI: deps.runTaskWithAI,
          updateTaskStatus: deps.updateTaskStatus,
          createDemoTask: deps.createDemoTask,
          createManualTask: deps.createManualTask,
          createTestPriceMonitorTask: deps.createTestPriceMonitorTask,

          // ✅ STAGE 7A — Project Memory wiring (FIX)
          getProjectSection: deps.getProjectSection,
          upsertProjectSection: deps.upsertProjectSection,
        };

        const result = await deps.dispatchCommand(cmdBase, dispatchCtx);
        if (result?.handled) {
          return { ok: true, stage: "6.logic.2", result: "command_handled", cmdBase };
        }
      } catch (e) {
        console.error("handleMessage(dispatchCommand) failed:", e);
        await replyAndLog("⛔ Ошибка при выполнении команды.", {
          cmd: cmdBase,
          event: "dispatch_error",
        });
        return { ok: false, reason: "dispatch_error", cmdBase };
      }
    }

    return { ok: true, stage: "6.logic.2", result: "unknown_command", cmdBase };
  }

  // --- MESSAGE ROUTING (non-command) ---
  if (typeof deps?.handleChatMessage === "function") {
    try {
      const memory = getMemoryService();

      const saveMessageToMemory = async (chatIdStr2, role, content, opts = {}) => {
        return memory.write({
          chatId: chatIdStr2,
          globalUserId: opts?.globalUserId ?? globalUserId ?? null,
          role,
          content: String(content ?? ""),
          transport: opts?.transport ?? transport,
          metadata: opts?.metadata ?? {},
          schemaVersion: opts?.schemaVersion ?? 2,
        });
      };

      const saveChatPair = async (chatIdStr2, _userText, assistantText, opts = {}) => {
        const meta = opts?.metadata ?? {};
        return memory.write({
          chatId: chatIdStr2,
          globalUserId: opts?.globalUserId ?? globalUserId ?? null,
          role: "assistant",
          content: String(assistantText ?? ""),
          transport: opts?.transport ?? transport,
          metadata: meta,
          schemaVersion: opts?.schemaVersion ?? 2,
        });
      };

      await deps.handleChatMessage({
        bot: deps.bot,
        msg: context.raw,
        chatId: chatIdNum,
        chatIdStr,
        senderIdStr: senderId || "",
        globalUserId,
        trimmed,
        MAX_HISTORY_MESSAGES: deps.MAX_HISTORY_MESSAGES || 20,

        FileIntake: deps.FileIntake,

        getChatHistory: deps.getChatHistory,
        saveMessageToMemory,
        saveChatPair,

        logInteraction: deps.logInteraction,
        loadProjectContext: deps.loadProjectContext,
        getAnswerMode: deps.getAnswerMode,
        buildSystemPrompt: deps.buildSystemPrompt,

        isMonarch: (id) => String(id || "") === envStr("MONARCH_USER_ID", ""),

        callAI: deps.callAI,
        sanitizeNonMonarchReply: deps.sanitizeNonMonarchReply,
      });

      return { ok: true, stage: "6.logic.2", result: "chat_handled" };
    } catch (e) {
      console.error("handleMessage(handleChatMessage) failed:", e);
      return { ok: false, reason: "chat_error" };
    }
  }

  return { ok: false, reason: "no_handler" };
}

export default handleMessage;