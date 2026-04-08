// src/bot/handlers/handlerAccess.js
// ============================================================================
// Shared handler access helper.
// Purpose:
// - unify privileged handler access checks without blind refactor
// - prefer resolved identity/access from ctx
// - allow controlled legacy fallback during transition
// IMPORTANT:
// - source of truth priority:
//   1) ctx.isMonarchUser (explicit resolved flag)
//   2) ctx.bypass (legacy dispatcher/core bridge boolean)
//   3) ctx.userRole / ctx.user.role
//   4) senderIdStr === MONARCH_USER_ID (temporary legacy fallback only)
// - NEVER trust chatId as actor identity
// ============================================================================

import { envStr } from "../../core/config.js";

function asTrimmedString(value) {
  return String(value ?? "").trim();
}

function resolveSenderIdStr(ctx = {}) {
  return asTrimmedString(ctx.senderIdStr);
}

function resolveChatId(ctx = {}) {
  return ctx.chatId ?? null;
}

function resolveChatIdStr(ctx = {}) {
  const direct = asTrimmedString(ctx.chatIdStr);
  if (direct) return direct;

  const fromChatId = ctx.chatId;
  if (fromChatId === null || fromChatId === undefined) return "";
  return asTrimmedString(fromChatId);
}

function resolveUserRole(ctx = {}) {
  const direct = asTrimmedString(ctx.userRole);
  if (direct) return direct;

  const nested = asTrimmedString(ctx?.user?.role);
  if (nested) return nested;

  return "guest";
}

function resolveUserPlan(ctx = {}) {
  const direct = asTrimmedString(ctx.userPlan);
  if (direct) return direct;

  const nested = asTrimmedString(ctx?.user?.plan);
  if (nested) return nested;

  return "free";
}

function resolveTransport(ctx = {}) {
  const direct = asTrimmedString(ctx.transport);
  if (direct) return direct;

  const nested = asTrimmedString(ctx?.identityCtx?.transport);
  if (nested) return nested;

  return "telegram";
}

function resolveChatType(ctx = {}) {
  const direct = asTrimmedString(ctx.chatType);
  if (direct) return direct;

  const nested =
    asTrimmedString(ctx?.identityCtx?.chatType) ||
    asTrimmedString(ctx?.identityCtx?.chat_type);

  if (nested) return nested;

  return "";
}

function resolveIsPrivateChat(ctx = {}) {
  if (ctx?.isPrivateChat === true) return true;
  if (ctx?.identityCtx?.isPrivateChat === true) return true;

  const chatType = resolveChatType(ctx);
  if (chatType === "private") return true;

  const chatIdStr = resolveChatIdStr(ctx);
  const senderIdStr = resolveSenderIdStr(ctx);

  return Boolean(chatIdStr && senderIdStr && chatIdStr === senderIdStr);
}

function resolveMonarchByCtx(ctx = {}) {
  if (typeof ctx?.isMonarchUser === "boolean") {
    return ctx.isMonarchUser;
  }

  if (typeof ctx?.bypass === "boolean") {
    return ctx.bypass;
  }

  const role = resolveUserRole(ctx);
  if (role === "monarch") {
    return true;
  }

  return null;
}

function resolveMonarchByLegacySender(ctx = {}) {
  const senderIdStr = resolveSenderIdStr(ctx);
  const monarchUserId = envStr("MONARCH_USER_ID", "").trim();

  if (!monarchUserId) return false;
  if (!senderIdStr) return false;

  return senderIdStr === monarchUserId;
}

async function replyText(ctx = {}, text) {
  if (typeof ctx?.reply === "function") {
    await ctx.reply(text, {
      handler: "handlerAccess",
      event: "permission_denied",
    });
    return;
  }

  const bot = ctx?.bot || null;
  const chatId = resolveChatId(ctx);

  if (bot && chatId !== null && chatId !== undefined) {
    await bot.sendMessage(chatId, text);
  }
}

export function resolveHandlerAccess(ctx = {}) {
  const senderIdStr = resolveSenderIdStr(ctx);
  const chatId = resolveChatId(ctx);
  const chatIdStr = resolveChatIdStr(ctx);
  const userRole = resolveUserRole(ctx);
  const userPlan = resolveUserPlan(ctx);
  const transport = resolveTransport(ctx);
  const chatType = resolveChatType(ctx);
  const isPrivateChat = resolveIsPrivateChat(ctx);

  const monarchByCtx = resolveMonarchByCtx(ctx);
  const isMonarchUser =
    typeof monarchByCtx === "boolean"
      ? monarchByCtx
      : resolveMonarchByLegacySender(ctx);

  return {
    bot: ctx?.bot || null,
    reply: typeof ctx?.reply === "function" ? ctx.reply : null,

    chatId,
    chatIdStr,
    senderIdStr,

    user: ctx?.user || null,
    userRole,
    userPlan,
    globalUserId: ctx?.globalUserId ?? ctx?.user?.global_user_id ?? null,

    transport,
    chatType,
    isPrivateChat,
    isMonarchUser,
  };
}

export async function requireMonarchAccess(ctx = {}) {
  const access = resolveHandlerAccess(ctx);

  if (access.isMonarchUser) {
    return true;
  }

  await replyText(ctx, "⛔ Недостаточно прав (monarch-only).");
  return false;
}

export async function requireMonarchPrivateAccess(ctx = {}) {
  const access = resolveHandlerAccess(ctx);

  if (!access.isPrivateChat) {
    await replyText(ctx, "⛔ Эта команда доступна только в личке.");
    return false;
  }

  if (!access.isMonarchUser) {
    await replyText(ctx, "⛔ Недостаточно прав (monarch-only).");
    return false;
  }

  return true;
}

export default {
  resolveHandlerAccess,
  requireMonarchAccess,
  requireMonarchPrivateAccess,
};