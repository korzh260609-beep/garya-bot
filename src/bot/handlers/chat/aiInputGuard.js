// src/bot/handlers/chat/aiInputGuard.js

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function truncateText(value, maxChars, suffix = "\n...[truncated]") {
  const text = safeText(value);
  const limit = Number(maxChars || 0);

  if (!Number.isFinite(limit) || limit <= 0) {
    return "";
  }

  if (text.length <= limit) {
    return text;
  }

  const safeLimit = Math.max(0, limit - suffix.length);
  return `${text.slice(0, safeLimit).trimEnd()}${suffix}`;
}

export const CHAT_AI_INPUT_LIMITS = {
  projectCtxChars: 4000,
  recallCtxChars: 6000,
  historyMessagesMax: 8,
  historyMessageChars: 1200,
  userTextChars: 12000,
  systemMessageChars: 2500,
  assistantMessageChars: 1200,
  genericMessageChars: 1500,
  partSummaryChars: 12000,
};

export function guardProjectContext(projectCtx = "") {
  return truncateText(
    projectCtx,
    CHAT_AI_INPUT_LIMITS.projectCtxChars,
    "\n...[project context truncated]"
  );
}

export function guardRecallContext(recallCtx = "") {
  return truncateText(
    recallCtx,
    CHAT_AI_INPUT_LIMITS.recallCtxChars,
    "\n...[recall truncated]"
  );
}

export function guardHistoryMessages(history = []) {
  const list = Array.isArray(history) ? history : [];
  const trimmed = list.slice(-CHAT_AI_INPUT_LIMITS.historyMessagesMax);

  return trimmed.map((item) => {
    const role = item?.role || "user";

    return {
      ...item,
      content: truncateText(
        item?.content ?? "",
        CHAT_AI_INPUT_LIMITS.historyMessageChars,
        "\n...[history truncated]"
      ),
      role,
    };
  });
}

export function guardChatMessages(messages = []) {
  const list = Array.isArray(messages) ? messages : [];

  return list.map((item, index) => {
    const role = item?.role || "user";
    const isLast = index === list.length - 1;

    let maxChars = CHAT_AI_INPUT_LIMITS.genericMessageChars;
    let suffix = "\n...[message truncated]";

    if (role === "system") {
      maxChars = CHAT_AI_INPUT_LIMITS.systemMessageChars;
      suffix = "\n...[system message truncated]";
    } else if (role === "assistant") {
      maxChars = CHAT_AI_INPUT_LIMITS.assistantMessageChars;
      suffix = "\n...[assistant history truncated]";
    } else if (role === "user" && isLast) {
      maxChars = CHAT_AI_INPUT_LIMITS.userTextChars;
      suffix = "\n...[user input truncated]";
    } else if (role === "user") {
      maxChars = CHAT_AI_INPUT_LIMITS.historyMessageChars;
      suffix = "\n...[user history truncated]";
    }

    return {
      ...item,
      role,
      content: truncateText(item?.content ?? "", maxChars, suffix),
    };
  });
}

export function buildChatInputGuardMeta({
  rawProjectCtx = "",
  rawRecallCtx = "",
  rawHistory = [],
  rawMessages = [],
  guardedProjectCtx = "",
  guardedRecallCtx = "",
  guardedHistory = [],
  guardedMessages = [],
}) {
  const rawHistoryCount = Array.isArray(rawHistory) ? rawHistory.length : 0;
  const guardedHistoryCount = Array.isArray(guardedHistory)
    ? guardedHistory.length
    : 0;

  const rawMessageCount = Array.isArray(rawMessages) ? rawMessages.length : 0;
  const guardedMessageCount = Array.isArray(guardedMessages)
    ? guardedMessages.length
    : 0;

  return {
    aiInputGuardVersion: "v1",
    rawProjectCtxChars: safeText(rawProjectCtx).length,
    guardedProjectCtxChars: safeText(guardedProjectCtx).length,
    rawRecallCtxChars: safeText(rawRecallCtx).length,
    guardedRecallCtxChars: safeText(guardedRecallCtx).length,
    rawHistoryCount,
    guardedHistoryCount,
    rawMessageCount,
    guardedMessageCount,
    projectCtxTrimmed:
      safeText(guardedProjectCtx).length < safeText(rawProjectCtx).length,
    recallCtxTrimmed:
      safeText(guardedRecallCtx).length < safeText(rawRecallCtx).length,
    historyTrimmed:
      guardedHistoryCount < rawHistoryCount ||
      JSON.stringify(rawHistory).length > JSON.stringify(guardedHistory).length,
    messagesTrimmed:
      JSON.stringify(rawMessages).length > JSON.stringify(guardedMessages).length,
  };
}

export function guardDocumentPartText(partText = "") {
  return truncateText(
    partText,
    CHAT_AI_INPUT_LIMITS.partSummaryChars,
    "\n...[document part truncated before AI summary]"
  );
}

export default {
  CHAT_AI_INPUT_LIMITS,
  guardProjectContext,
  guardRecallContext,
  guardHistoryMessages,
  guardChatMessages,
  buildChatInputGuardMeta,
  guardDocumentPartText,
};