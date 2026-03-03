// src/core/handleMessage.js
// STAGE 6.4 — handleMessage(context) — Core entrypoint for any transport.
//
// Evolution:
//   v1: SKELETON — derived chat meta only
//   v2: STAGE 7.1 — Memory shadow write
//   v3: STAGE 6 LOGIC STEP 1 — Access check + identity resolution (shadow-safe)
//   v4: STAGE 6 LOGIC STEP 2 — Routing (command vs message), reply via adapter
//
// IMPORTANT:
//   Shadow-wired when deps.reply / deps.callAI are not provided.
//   TRANSPORT_ENFORCED=false by default — old messageRouter remains authoritative.
//   When deps are provided (enforced mode), this function produces real replies.

import { deriveChatMeta } from "./transportMeta.js";
import { isTransportTraceEnabled } from "../transport/transportConfig.js";
import { getMemoryService } from "./memoryServiceFactory.js";

// ✅ STAGE 6 LOGIC — Access + Identity
import { resolveUserAccess } from "../users/userAccess.js";
import { ensureUserProfile } from "../users/userProfile.js";
import { can } from "../users/permissions.js";
import { envStr } from "./config.js";

// ✅ STAGE 6 LOGIC — Routing helpers
import { CMD_ACTION } from "../bot/cmdActionMap.js";
import { parseCommand } from "../../core/helpers.js";

function envBool(name, def = false) {
  const v = envStr(name, def ? "true" : "false").trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return def;
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
      console.log("📨 handleMessage(v4)", {
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
  // STAGE 7.1 — Memory shadow write
  //
  // 🚫 IMPORTANT:
  // Shadow mode currently DOES NOT generate assistant replies.
  // If we write only user messages here, /memory_integrity will show u=1 a=0 anomalies.
  //
  // ✅ Therefore: shadow write is OFF by default.
  // Enable ONLY when you intentionally want shadow writes:
  //   MEMORY_SHADOW_WRITE=true
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
  // ROUTING — only when enforced (deps provided)
  // Shadow mode: compute routing but don't act
  // =========================================================================
  if (!isEnforced) {
    return {
      ok: true,
      stage: "6.logic.2",
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

  // --- COMMAND ROUTING ---
  if (isCommand && cmdBase) {
    if (!canProceed) {
      await deps.reply(context, "⛔ Недостаточно прав.");
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
          chatType,
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
        };

        const result = await deps.dispatchCommand(cmdBase, dispatchCtx);
        if (result?.handled) {
          return { ok: true, stage: "6.logic.2", result: "command_handled", cmdBase };
        }
      } catch (e) {
        console.error("handleMessage(dispatchCommand) failed:", e);
        await deps.reply(context, "⛔ Ошибка при выполнении команды.");
        return { ok: false, reason: "dispatch_error", cmdBase };
      }
    }

    // Unknown command — silent drop (matches messageRouter behaviour)
    return { ok: true, stage: "6.logic.2", result: "unknown_command", cmdBase };
  }

  // --- MESSAGE ROUTING (non-command) ---
  if (typeof deps?.handleChatMessage === "function") {
    try {
      const memory = getMemoryService();

      // ✅ Real writers for enforced mode (fix pair anomalies):
      // - user message written by handleChatMessage via saveMessageToMemory
      // - assistant message written via saveChatPair (assistant-only, same messageId)
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
        // IMPORTANT: write ONLY assistant to avoid double-writing user
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
