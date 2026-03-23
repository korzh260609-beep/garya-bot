// src/core/handleMessage/normalizeContext.js

import { deriveChatMeta } from "../transportMeta.js";
import { parseCommand } from "../../../core/helpers.js";
import { IDEMPOTENCY_BYPASS } from "./shared.js";

export function normalizeContext(context = {}) {
  const transport = String(context?.transport || "unknown");
  const chatId = context?.chatId == null ? null : String(context.chatId);
  const senderId = context?.senderId == null ? null : String(context.senderId);
  const text = context?.text == null ? "" : String(context.text);
  const messageId = context?.messageId == null ? null : String(context.messageId);
  const raw = context?.raw && typeof context.raw === "object" ? context.raw : null;

  const trimmedForBypass = text.trim();
  const isCommandForBypass = trimmedForBypass.startsWith("/");
  const parsedForBypass = isCommandForBypass ? parseCommand(trimmedForBypass) : null;
  const cmdBaseForBypass = parsedForBypass
    ? String(parsedForBypass.cmd).split("@")[0]
    : null;

  const deps = context?.deps || null;
  const hasReply = typeof deps?.reply === "function";
  const hasCallAI = typeof deps?.callAI === "function";
  const isEnforced = hasReply && hasCallAI;

  const globalUserId =
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

  return {
    context,
    transport,
    chatId,
    senderId,
    text,
    messageId,
    raw,
    deps,
    hasReply,
    hasCallAI,
    isEnforced,
    globalUserId,
    derived,
    chatType,
    isPrivateChat,
    trimmed: text.trim(),
    bypassParsed: {
      isCommandForBypass,
      parsedForBypass,
      cmdBaseForBypass,
      isBypass: IDEMPOTENCY_BYPASS.has(cmdBaseForBypass),
    },
  };
}