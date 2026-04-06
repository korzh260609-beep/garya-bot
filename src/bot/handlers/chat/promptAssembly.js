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
      "MEDIA: короткий ответ по изображению/объекту.",
      "1-2 коротких предложения.",
      "Сначала прямой ответ, затем при необходимости одно короткое уточнение.",
      "Без длинных списков и лишних объяснений.",
      "При неуверенности: 'Похоже на ...'.",
    ].join("\n");
  }

  if (mediaResponseMode === "document_summary_answer") {
    return [
      "MEDIA: краткое summary документа.",
      "Формат: 1 короткая строка о сути + 2-4 коротких пункта.",
      "Не выводить полный текст, если пользователь прямо не просил.",
      "Не пересказывать документ по разделам.",
      "В конце можно одной короткой строкой указать, что доступен полный текст или вывод по частям.",
    ].join("\n");
  }

  if (mediaResponseMode === "document_full_text_answer") {
    return [
      "MEDIA: пользователь просит текст документа, не summary.",
      "Выводи текст документа.",
      "Если длинно — только первую часть и явно скажи, что это часть 1.",
      "Не заменять полный текст summary.",
    ].join("\n");
  }

  return "";
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
        "Текущий пользователь не монарх.",
        "Не обращаться: 'Монарх', 'Ваше Величество', 'Государь'.",
        "Используй нейтральное обращение.",
      ].join("\n")
    );
  }

  if (stablePersonalFactMode) {
    blocks.push(
      [
        "STABLE PERSONAL FACT:",
        "Если вопрос о стабильном факте пользователя, LONG-TERM MEMORY = основной источник.",
        "Не подменяй сохранённый факт недавним чатом или догадкой.",
        "Имя/факт воспроизводи точно как сохранено.",
        "Не добавляй титулы и украшения.",
        "Отвечай прямо, без обращения и приветствия.",
      ].join("\n")
    );
  }

  if (!stablePersonalFactMode && recallCtx) {
    blocks.push(
      [
        "RECALL:",
        `Используй этот контекст как историю чата:\n${recallCtx}`,
        "Если пользователь спрашивает, что обсуждали раньше, опирайся на RECALL.",
        "Если точных данных нет — скажи честно и не выдумывай.",
      ].join("\n")
    );
  }

  if (!stablePersonalFactMode && likelyContextualReaction) {
    blocks.push(
      [
        "CONTEXTUAL REACTION:",
        "Текущее сообщение похоже на короткую реакцию на прошлый ответ.",
        "Не задавай generic-уточнение вроде 'Что именно нужно сделать?'",
        "Лучше коротко подтвердить и естественно продолжить тему.",
      ].join("\n")
    );
  }

  if (!stablePersonalFactMode && !likelyContextualReaction && needsClarificationFirst) {
    blocks.push(
      [
        "CLARIFICATION-FIRST:",
        "Запрос структурно слишком расплывчатый.",
        "Не угадывай объект действия по соседнему контексту.",
        "Задай ровно ОДИН короткий нейтральный уточняющий вопрос.",
        "Не сужай вопрос до одной догадки.",
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
    auxPolicySystemMessage,
    ...historyMessages,
    { role: "user", content: effective },
  ];

  return {
    modeInstruction,
    systemPrompt,
    roleGuardPrompt: monarchNow
      ? "SYSTEM ROLE: MONARCH"
      : "SYSTEM ROLE: NON_MONARCH",
    stablePersonalFactMode,
    messages: messages.filter(Boolean),
  };
}