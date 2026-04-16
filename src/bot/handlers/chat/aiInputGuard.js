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

function normalizeChatType(chatType = "") {
  return String(chatType || "").trim().toLowerCase();
}

function isSharedChatType(chatType = "") {
  const v = normalizeChatType(chatType);
  return v === "group" || v === "supergroup";
}

function normalizeLines(text = "") {
  return safeText(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());
}

function isProjectContextStatusLikeLine(line = "") {
  const text = safeText(line).trim().toLowerCase();
  if (!text) return false;

  const patterns = [
    "current stage",
    "текущий этап",
    "поточний етап",
    "current focus",
    "текущий фокус",
    "поточний фокус",
    "completed",
    "done",
    "implemented",
    "started",
    "in progress",
    "partially completed",
    "partially implemented",
    "выполнен",
    "выполнено",
    "реализован",
    "реализовано",
    "начат",
    "начато",
    "в процессе",
    "частично",
    "підтверджено",
    "виконано",
    "реалізовано",
    "розпочато",
    "у процесі",
  ];

  if (patterns.some((p) => text.includes(p))) {
    return true;
  }

  if (/^stage\s*\d+/i.test(text)) return true;
  if (/^этап\s*\d+/i.test(text)) return true;
  if (/^етап\s*\d+/i.test(text)) return true;

  return false;
}

function sanitizeProjectContextForAi(projectCtx = "") {
  const lines = normalizeLines(projectCtx);
  const kept = [];

  for (const line of lines) {
    const trimmed = String(line || "").trim();

    if (!trimmed) {
      if (kept.length > 0 && kept[kept.length - 1] !== "") {
        kept.push("");
      }
      continue;
    }

    if (isProjectContextStatusLikeLine(trimmed)) {
      continue;
    }

    kept.push(trimmed);
  }

  const collapsed = [];
  for (const line of kept) {
    if (line === "" && collapsed[collapsed.length - 1] === "") continue;
    collapsed.push(line);
  }

  const sanitizedBody = collapsed.join("\n").trim();
  if (!sanitizedBody) return "";

  return [
    "UNVERIFIED PROJECT MEMORY BACKGROUND:",
    "This block is background only.",
    "Do not use it as proof of current stage/status/implementation.",
    sanitizedBody,
  ].join("\n");
}

function normalizeQuestionText(value = "") {
  return safeText(value).trim().toLowerCase();
}

export function isCurrentActivityQuestion(text = "") {
  const q = normalizeQuestionText(text);
  if (!q) return false;

  const patterns = [
    "что мы сейчас делаем",
    "что мы делаем сейчас",
    "что мы сейчас делали",
    "над чем мы сейчас работаем",
    "что мы сейчас обсуждаем",
    "о чем мы сейчас говорим",
    "на чем мы сейчас остановились",
    "чем мы сейчас занимаемся",

    "що ми зараз робимо",
    "що ми робимо зараз",
    "над чим ми зараз працюємо",
    "що ми зараз обговорюємо",
    "про що ми зараз говоримо",
    "на чому ми зараз зупинилися",
    "чим ми зараз займаємося",

    "what are we doing now",
    "what are we working on now",
    "what are we discussing now",
    "where did we stop",
    "what are we doing at the moment",
    "what are we working on at the moment",
  ];

  return patterns.some((p) => q.includes(p));
}

export const CHAT_AI_INPUT_LIMITS = {
  projectCtxChars: 500,
  recallCtxChars: 400,

  historyMessagesMax: 2,
  historyMessagesMaxGroup: 4,

  historyMessagesMaxCurrentActivity: 6,
  historyMessagesMaxCurrentActivityGroup: 6,

  historyMessageChars: 300,
  historyMessageCharsGroup: 220,

  historyMessageCharsCurrentActivity: 420,
  historyMessageCharsCurrentActivityGroup: 260,

  userTextChars: 6000,
  systemMessageChars: 900,
  assistantMessageChars: 400,
  genericMessageChars: 500,
  partSummaryChars: 6000,
};

export function guardProjectContext(projectCtx = "") {
  const sanitized = sanitizeProjectContextForAi(projectCtx);

  return truncateText(
    sanitized,
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

export function guardHistoryMessages(history = [], opts = {}) {
  const list = Array.isArray(history) ? history : [];
  const sharedChat = isSharedChatType(opts?.chatType);
  const currentActivityMode = isCurrentActivityQuestion(opts?.userText || "");

  const maxMessages = currentActivityMode
    ? sharedChat
      ? CHAT_AI_INPUT_LIMITS.historyMessagesMaxCurrentActivityGroup
      : CHAT_AI_INPUT_LIMITS.historyMessagesMaxCurrentActivity
    : sharedChat
      ? CHAT_AI_INPUT_LIMITS.historyMessagesMaxGroup
      : CHAT_AI_INPUT_LIMITS.historyMessagesMax;

  const maxCharsPerMessage = currentActivityMode
    ? sharedChat
      ? CHAT_AI_INPUT_LIMITS.historyMessageCharsCurrentActivityGroup
      : CHAT_AI_INPUT_LIMITS.historyMessageCharsCurrentActivity
    : sharedChat
      ? CHAT_AI_INPUT_LIMITS.historyMessageCharsGroup
      : CHAT_AI_INPUT_LIMITS.historyMessageChars;

  const trimmed = list.slice(-maxMessages);

  return trimmed.map((item) => {
    const role = item?.role || "user";

    return {
      ...item,
      content: truncateText(
        item?.content ?? "",
        maxCharsPerMessage,
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
  userText = "",
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
    aiInputGuardVersion: "v6-current-activity-aware",
    rawProjectCtxChars: safeText(rawProjectCtx).length,
    guardedProjectCtxChars: safeText(guardedProjectCtx).length,
    rawRecallCtxChars: safeText(rawRecallCtx).length,
    guardedRecallCtxChars: safeText(guardedRecallCtx).length,
    rawHistoryCount,
    guardedHistoryCount,
    rawMessageCount,
    guardedMessageCount,
    currentActivityQuestionDetected: isCurrentActivityQuestion(userText),
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
  isCurrentActivityQuestion,
};