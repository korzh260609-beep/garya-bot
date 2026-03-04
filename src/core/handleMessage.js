// src/core/handleMessage.js
// STAGE 6.4 — handleMessage(context) — Core entrypoint for any transport.

import { deriveChatMeta } from "./transportMeta.js";
import { isTransportTraceEnabled } from "../transport/transportConfig.js";
import { getMemoryService } from "./memoryServiceFactory.js";

import { resolveUserAccess } from "../users/userAccess.js";
import { ensureUserProfile } from "../users/userProfile.js";
import { can } from "../users/permissions.js";

import { envStr, envIntRange } from "./config.js";

import { CMD_ACTION } from "../bot/cmdActionMap.js";
import { parseCommand } from "../../core/helpers.js";

import { checkRateLimit } from "../bot/rateLimiter.js";

import { BehaviorEventsService } from "../logging/BehaviorEventsService.js";

import { insertCommandInvocation } from "../db/commandInvocationsRepo.js";

const behaviorEvents = new BehaviorEventsService();

const CMD_RL_WINDOW_MS = envIntRange("CMD_RL_WINDOW_MS", 20000, {
  min: 1000,
  max: 300000,
});

const CMD_RL_MAX = envIntRange("CMD_RL_MAX", 6, {
  min: 1,
  max: 50,
});

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

  const deps = context?.deps || null;
  const hasReply = typeof deps?.reply === "function";
  const hasCallAI = typeof deps?.callAI === "function";

  const isEnforced = hasReply && hasCallAI;

  let globalUserId =
    context?.globalUserId == null ? null : String(context.globalUserId);

  const derived = deriveChatMeta({
    transport,
    chatId,
    senderId,
    transportChatType: context?.transportChatType ?? context?.chatType ?? null,
  });

  const chatType = derived.chatType || null;
  const isPrivateChat =
    typeof context?.isPrivateChat === "boolean"
      ? context.isPrivateChat
      : derived.isPrivateChat;

  // -------------------------------------------------------------------------
  // STAGE 6.8 — Idempotency guard (transport-level)
  // -------------------------------------------------------------------------
  if (isEnforced) {
    const dedupeKey = context?.dedupeKey || null;

    if (!dedupeKey || !messageId) {
      if (isTransportTraceEnabled()) {
        console.warn("ENFORCED_DROP_NO_DEDUPE", {
          transport,
          chatId,
          senderId,
          messageId,
          dedupeKey,
        });
      }

      return {
        ok: false,
        reason: "missing_dedupeKey",
        stage: "6.8",
      };
    }
  }

  // -------------------------------------------------------------------------
  // Identity + Access
  // -------------------------------------------------------------------------
  let userRole = "guest";
  let userPlan = "free";
  let user = { role: "guest", plan: "free", global_user_id: null };

  if (transport === "telegram" && senderId) {
    try {
      if (context?.raw && typeof context.raw === "object") {
        await ensureUserProfile(context.raw);
      }
    } catch (e) {
      console.error("ensureUserProfile failed:", e);
    }

    try {
      const MONARCH_USER_ID = envStr("MONARCH_USER_ID", "").trim();

      const accessPack = await resolveUserAccess({
        senderIdStr: senderId,
        isMonarch: (id) => String(id || "") === MONARCH_USER_ID,
        provider: transport,
      });

      userRole = accessPack?.userRole || "guest";
      userPlan = accessPack?.userPlan || "free";
      user = accessPack?.user || user;

      if (!globalUserId && user?.global_user_id) {
        globalUserId = user.global_user_id;
      }
    } catch (e) {
      console.error("resolveUserAccess failed:", e);
    }
  }

  const isMonarchUser = userRole === "monarch";

  const trimmed = text.trim();
  const isCommand = trimmed.startsWith("/");
  const parsed = isCommand ? parseCommand(trimmed) : null;
  const cmdBase = parsed ? String(parsed.cmd).split("@")[0] : null;
  const rest = parsed?.rest || "";

  let canProceed = true;

  if (isCommand && cmdBase) {
    const action = CMD_ACTION[cmdBase];
    if (action) {
      canProceed = can(user, action);
    }
  }

  // -------------------------------------------------------------------------
  // COMMAND IDEMPOTENCY (Stage 6.8.2)
  // -------------------------------------------------------------------------
  if (isCommand && cmdBase && chatId && messageId) {
    try {
      const ins = await insertCommandInvocation({
        transport,
        chatId,
        messageId: Number(messageId),
        cmd: cmdBase,
        globalUserId: globalUserId || null,
        senderId,
        metadata: { source: "core.handleMessage" },
      });

      if (!ins?.inserted) {
        return {
          ok: true,
          stage: "6.8.2",
          result: "duplicate_command_drop",
          cmdBase,
        };
      }
    } catch (e) {
      console.error("command idempotency guard failed:", e);
    }
  }

  if (!isEnforced) {
    return {
      ok: true,
      stage: "6.shadow",
      note: "shadow mode",
    };
  }

  const chatIdNum = chatId ? Number(chatId) : null;
  const chatIdStr = chatId || "";

  if (!chatIdNum) {
    return { ok: false, reason: "missing_chatId" };
  }

  // -------------------------------------------------------------------------
  // COMMAND ROUTING
  // -------------------------------------------------------------------------
  if (isCommand && cmdBase) {
    if (!isMonarchUser && cmdBase !== "/start" && cmdBase !== "/help") {
      const rlKey = `${senderId || ""}:${chatIdStr}:cmd`;

      const rl = checkRateLimit({
        key: rlKey,
        windowMs: CMD_RL_WINDOW_MS,
        max: CMD_RL_MAX,
      });

      if (!rl.allowed) {
        const sec = Math.ceil(rl.retryAfterMs / 1000);

        await deps.reply(context, `⛔ Слишком часто. Подожди ${sec} сек.`);

        return { ok: true, result: "rate_limited", cmdBase };
      }
    }

    if (!canProceed) {
      await deps.reply(context, "⛔ Недостаточно прав.");
      return { ok: true, result: "permission_denied", cmdBase };
    }

    if (typeof deps?.dispatchCommand === "function") {
      const result = await deps.dispatchCommand(cmdBase, {
        bot: deps.bot,
        chatId: chatIdNum,
        chatIdStr,
        senderIdStr: senderId || "",
        rest,
        user,
        userRole,
        userPlan,
        bypass: isMonarchUser,
      });

      if (result?.handled) {
        return { ok: true, result: "command_handled", cmdBase };
      }
    }

    return { ok: true, result: "unknown_command", cmdBase };
  }

  // -------------------------------------------------------------------------
  // CHAT MESSAGE ROUTING
  // -------------------------------------------------------------------------
  if (typeof deps?.handleChatMessage === "function") {
    await deps.handleChatMessage({
      bot: deps.bot,
      msg: context.raw,
      chatId: chatIdNum,
      chatIdStr,
      senderIdStr: senderId || "",
      globalUserId,
      trimmed,
      MAX_HISTORY_MESSAGES: deps.MAX_HISTORY_MESSAGES || 20,
      callAI: deps.callAI,
    });

    return { ok: true, result: "chat_handled" };
  }

  return { ok: false, reason: "no_handler" };
}

export default handleMessage;
