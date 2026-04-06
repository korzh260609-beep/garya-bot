// src/bot/handlers/chat/promptAssembly.js

import isStablePersonalFactQuestion from "./isStablePersonalFactQuestion.js";

export function buildModeInstruction(answerMode) {
  if (answerMode === "short") {
    return "Режим short: отвечай очень кратко (1–2 предложения), только по существу, без лишних деталей.";
  }

  if (answerMode === "normal") {
    return "Режим normal: давай развёрнутый, но компактный ответ (3–7 предложений), с ключевыми деталями.";
  }

  if (answerMode === "long") {
    return "Режим long: можно отвечать подробно, структурированно, с примерами и пояснениями.";
  }

  return "";
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function countWords(value) {
  const text = normalizeWhitespace(value);
  if (!text) return 0;
  return text.split(" ").filter(Boolean).length;
}

function countSentenceMarks(value) {
  const text = String(value || "");
  const m = text.match(/[.!?]/g);
  return Array.isArray(m) ? m.length : 0;
}

function countLineBreaks(value) {
  const text = String(value || "");
  const m = text.match(/\n/g);
  return Array.isArray(m) ? m.length : 0;
}

function hasStructuredPayload(value) {
  const text = String(value || "");
  if (!text) return false;

  if (text.includes("\n")) return true;
  if (text.includes(":")) return true;
  if (text.includes("{") || text.includes("}")) return true;
  if (text.includes("[") || text.includes("]")) return true;
  if (text.includes("/")) return true;
  if (text.includes("http://") || text.includes("https://")) return true;

  return false;
}

function isStructurallyUnderspecifiedRequest(value) {
  const text = normalizeWhitespace(value);
  if (!text) return false;

  const chars = text.length;
  const words = countWords(text);
  const sentenceMarks = countSentenceMarks(text);
  const lineBreaks = countLineBreaks(text);
  const structuredPayload = hasStructuredPayload(text);

  const shortByChars = chars <= 24;
  const shortByWords = words <= 3;
  const lowStructure = sentenceMarks <= 1 && lineBreaks === 0 && !structuredPayload;

  return shortByChars && shortByWords && lowStructure;
}

function getLastAssistantMessage(history) {
  if (!Array.isArray(history) || history.length === 0) return null;

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const item = history[i];
    if (item?.role === "assistant" && typeof item?.content === "string") {
      return item.content;
    }
  }

  return null;
}

function hasReactionToneHints(text) {
  const s = String(text || "").trim();
  if (!s) return false;

  if (s.includes(")") || s.includes("))")) return true;
  if (s.includes("👍") || s.includes("👌") || s.includes("🙂") || s.includes("😊")) return true;
  if (s.endsWith("!")) return true;

  return false;
}

function isLikelyAcknowledgmentToken(text) {
  const s = normalizeWhitespace(text).toLowerCase();
  if (!s) return false;

  const compact = s.replace(/[()!.,]+/g, "").trim();

  return new Set([
    "ок",
    "ok",
    "okay",
    "да",
    "ага",
    "угу",
    "ясно",
    "понял",
    "понятно",
    "принял",
    "хорошо",
    "норм",
    "нормально",
    "супер",
    "отлично",
  ]).has(compact);
}

function isLikelyContextualReactionMessage(value, history) {
  const text = normalizeWhitespace(value);
  if (!text) return false;

  const chars = text.length;
  const words = countWords(text);
  const sentenceMarks = countSentenceMarks(text);
  const lineBreaks = countLineBreaks(text);
  const structuredPayload = hasStructuredPayload(text);
  const endsWithQuestion = text.endsWith("?");

  if (endsWithQuestion) return false;
  if (structuredPayload) return false;
  if (lineBreaks > 0) return false;
  if (sentenceMarks > 2) return false;
  if (chars > 80) return false;
  if (words > 8) return false;

  const lastAssistantMessage = getLastAssistantMessage(history);
  if (!lastAssistantMessage) return false;

  const lastAssistantChars = normalizeWhitespace(lastAssistantMessage).length;
  const lastAssistantWords = countWords(lastAssistantMessage);
  const lastAssistantWasSubstantive =
    lastAssistantChars >= 80 || lastAssistantWords >= 12;

  if (!lastAssistantWasSubstantive) {
    return false;
  }

  const reactionTone = hasReactionToneHints(text);
  const acknowledgmentToken = isLikelyAcknowledgmentToken(text);
  const shortEvaluativeUtterance =
    chars <= 40 && words <= 4 && !endsWithQuestion && !structuredPayload;

  return reactionTone || acknowledgmentToken || shortEvaluativeUtterance;
}

function buildMediaResponsePolicy(mediaResponseMode) {
  if (mediaResponseMode === "short_object_answer") {
    return [
      "MEDIA:",
      "- short answer about image/object",
      "- 1-2 short sentences",
      "- direct answer first",
      "- if unsure: 'Похоже на ...'",
    ].join("\n");
  }

  if (mediaResponseMode === "document_summary_answer") {
    return [
      "MEDIA:",
      "- short document summary",
      "- 1 short line of essence + 2-4 short points",
      "- do not output full text unless explicitly asked",
    ].join("\n");
  }

  if (mediaResponseMode === "document_full_text_answer") {
    return [
      "MEDIA:",
      "- user wants document text, not summary",
      "- output the text",
      "- if too long, give only part 1 and say it clearly",
    ].join("\n");
  }

  return "";
}

function truncateReplyText(value, maxChars = 220) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()} ...[reply truncated]`;
}

function buildReplyContextSystemMessage(replyContext) {
  if (!replyContext?.exists) return null;

  const authorLabel = String(replyContext?.authorLabel || "unknown_user").trim();
  const replyText = truncateReplyText(replyContext?.replyText || "");

  return {
    role: "system",
    content: [
      "REPLY CONTEXT:",
      "- current user replied to an earlier message",
      "- if user asks about 'this message' / 'этого сообщения' / 'этого текста', first interpret it as the replied message",
      `- replied message author: ${authorLabel}`,
      replyText ? `- replied message text: ${replyText}` : "- replied message text: [not available]",
      "- do not confuse replied-message author with current sender",
    ].join("\n"),
  };
}

function buildAuxPolicySystemMessage({
  monarchNow,
  stablePersonalFactMode,
  recallCtx,
  likelyContextualReaction,
  needsClarificationFirst,
  mediaResponseMode,
}) {
  const blocks = [];

  if (!monarchNow) {
    blocks.push(
      [
        "ROLE:",
        "- current user is not monarch",
        "- do not address as Monarch / Ваше Величество / Государь",
        "- use neutral addressing",
      ].join("\n")
    );
  }

  if (stablePersonalFactMode) {
    blocks.push(
      [
        "STABLE FACT:",
        "- LONG-TERM MEMORY is primary source",
        "- do not replace saved fact with guess or recent chat",
        "- reproduce saved name/fact exactly",
        "- answer directly, without decorative addressing",
      ].join("\n")
    );
  }

  if (!stablePersonalFactMode && recallCtx) {
    blocks.push(
      [
        "RECALL:",
        "- use this as prior chat context when relevant",
        "- if user asks what was discussed before, rely on RECALL",
        "- if data is missing, say so honestly",
        "",
        recallCtx,
      ].join("\n")
    );
  }

  if (!stablePersonalFactMode && likelyContextualReaction) {
    blocks.push(
      [
        "REACTION:",
        "- current message looks like a short reaction to prior answer",
        "- do not ask generic clarification",
        "- briefly acknowledge and continue naturally",
      ].join("\n")
    );
  }

  if (!stablePersonalFactMode && !likelyContextualReaction && needsClarificationFirst) {
    blocks.push(
      [
        "CLARIFY FIRST:",
        "- request is too vague",
        "- do not guess object from nearby context",
        "- ask one short neutral clarifying question",
      ].join("\n")
    );
  }

  const mediaPolicy = buildMediaResponsePolicy(mediaResponseMode);
  if (mediaPolicy) {
    blocks.push(mediaPolicy);
  }

  if (!blocks.length) return null;

  return {
    role: "system",
    content: blocks.join("\n\n"),
  };
}

function countChars(value) {
  if (value === null || value === undefined) return 0;
  return String(value).length;
}

function sumMessageChars(list = []) {
  const items = Array.isArray(list) ? list : [];
  return items.reduce((sum, item) => sum + countChars(item?.content), 0);
}

function sumMessageCharsByRole(list = [], role = "user") {
  const items = Array.isArray(list) ? list : [];
  return items.reduce((sum, item) => {
    if ((item?.role || "user") !== role) return sum;
    return sum + countChars(item?.content);
  }, 0);
}

export function buildChatMessages({
  buildSystemPrompt,
  answerMode,
  projectCtx,
  monarchNow,
  msg,
  effective,
  mediaResponseMode,
  sourceServiceSystemMessage,
  sourceResultSystemMessage,
  longTermMemorySystemMessage,
  recallCtx,
  history,
  replyContext,
}) {
  const modeInstruction = buildModeInstruction(answerMode);

  const currentUserName =
    [msg?.from?.first_name, msg?.from?.last_name].filter(Boolean).join(" ").trim() ||
    (msg?.from?.username ? `@${msg.from.username}` : "пользователь");

  const systemPrompt = buildSystemPrompt(answerMode, modeInstruction, projectCtx || "", {
    isMonarch: monarchNow,
    currentUserName,
    userText: effective,
  });

  const stablePersonalFactMode =
    Boolean(longTermMemorySystemMessage) && isStablePersonalFactQuestion(effective);

  const historyMessages = stablePersonalFactMode
    ? []
    : Array.isArray(history)
    ? history
    : [];

  const likelyContextualReaction =
    !stablePersonalFactMode &&
    isLikelyContextualReactionMessage(effective, historyMessages);

  const needsClarificationFirst =
    !stablePersonalFactMode &&
    !likelyContextualReaction &&
    isStructurallyUnderspecifiedRequest(effective);

  const replyContextSystemMessage = buildReplyContextSystemMessage(replyContext);

  const auxPolicySystemMessage = buildAuxPolicySystemMessage({
    monarchNow,
    stablePersonalFactMode,
    recallCtx,
    likelyContextualReaction,
    needsClarificationFirst,
    mediaResponseMode,
  });

  const messages = [
    { role: "system", content: systemPrompt },
    sourceServiceSystemMessage,
    sourceResultSystemMessage,
    longTermMemorySystemMessage,
    replyContextSystemMessage,
    auxPolicySystemMessage,
    ...historyMessages,
    { role: "user", content: effective },
  ];

  const promptBlockDiagnostics = {
    promptBlockSystemPromptChars: countChars(systemPrompt),
    promptBlockSourceServiceChars: countChars(sourceServiceSystemMessage?.content),
    promptBlockSourceResultChars: countChars(sourceResultSystemMessage?.content),
    promptBlockLongTermMemoryChars: countChars(longTermMemorySystemMessage?.content),
    promptBlockReplyContextChars: countChars(replyContextSystemMessage?.content),
    promptBlockAuxPolicyChars: countChars(auxPolicySystemMessage?.content),

    promptBlockHistoryCount: historyMessages.length,
    promptBlockHistoryTotalChars: sumMessageChars(historyMessages),
    promptBlockHistoryUserChars: sumMessageCharsByRole(historyMessages, "user"),
    promptBlockHistoryAssistantChars: sumMessageCharsByRole(historyMessages, "assistant"),
    promptBlockHistoryOtherChars:
      sumMessageChars(historyMessages) -
      sumMessageCharsByRole(historyMessages, "user") -
      sumMessageCharsByRole(historyMessages, "assistant"),

    promptBlockFinalUserChars: countChars(effective),
    promptBlockPreGuardMessageCount: messages.filter(Boolean).length,
    promptBlockPreGuardTotalChars: sumMessageChars(messages.filter(Boolean)),
  };

  return {
    modeInstruction,
    systemPrompt,
    roleGuardPrompt: monarchNow
      ? "SYSTEM ROLE: MONARCH"
      : "SYSTEM ROLE: NON_MONARCH",
    stablePersonalFactMode,
    promptBlockDiagnostics,
    messages: messages.filter(Boolean),
  };
}