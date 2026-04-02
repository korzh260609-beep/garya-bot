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

function buildMediaResponseOverrideSystemMessage(mediaResponseMode) {
  if (mediaResponseMode === "short_object_answer") {
    return {
      role: "system",
      content:
        "SHORT MEDIA ANSWER RULE:\n" +
        "The current user request is a simple short question about an image, object, or visible scene.\n" +
        "Answer in 1 or 2 short sentences maximum.\n" +
        "Sentence 1: give the direct answer about what is shown.\n" +
        "Sentence 2: only if needed, add one short note about uncertainty or one key visible trait.\n" +
        "Do not write long lists.\n" +
        "Do not expand into broad explanations unless the user explicitly asks for detail.\n" +
        "If identification is uncertain, prefer cautious wording such as 'Похоже на ...'.",
    };
  }

  if (mediaResponseMode === "document_summary_answer") {
    return {
      role: "system",
      content:
        "DOCUMENT SUMMARY RULE:\n" +
        "The current request is about a document.\n" +
        "Give only a SHORT compact summary of the document.\n" +
        "Target format:\n" +
        "1) one short line: what the document is about,\n" +
        "2) then 2-4 very short bullet points with the main points.\n" +
        "Do NOT output the full document text unless the user explicitly asks for it.\n" +
        "Do NOT write long paragraphs.\n" +
        "Do NOT retell the whole document section by section.\n" +
        "If structured document hints are present in the user context, use them: title, headings, stats, block previews.\n" +
        "Prefer extracting the main meaning from the whole document context, not from the first lines only.\n" +
        "Keep the summary dense, useful, and short.\n" +
        "At the end, add only one short line telling the user they can ask for the full text or for output in parts.",
    };
  }

  if (mediaResponseMode === "document_full_text_answer") {
    return {
      role: "system",
      content:
        "DOCUMENT FULL TEXT RULE:\n" +
        "The user is asking for the document text itself, not a summary.\n" +
        "Output the document text.\n" +
        "If it is too long, output only the first part and clearly say that this is part 1 and the user should write 'продолжай' for the next part.\n" +
        "Do NOT replace the full text with a summary.\n" +
        "Preserve the original meaning of the document text.",
    };
  }

  return null;
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

  const roleGuardPrompt = monarchNow
    ? "SYSTEM ROLE: текущий пользователь = MONARCH (разрешено обращаться 'Монарх', 'Гарик')."
    : "SYSTEM ROLE: текущий пользователь НЕ монарх. Запрещено обращаться 'Монарх', 'Ваше Величество', 'Государь'. Называй: 'гость' или нейтрально (вы/ты).";

  const stablePersonalFactMode =
    Boolean(longTermMemorySystemMessage) && isStablePersonalFactQuestion(effective);

  const stablePersonalFactGuardSystemMessage = stablePersonalFactMode
    ? {
        role: "system",
        content:
          "STABLE PERSONAL FACT RULE:\n" +
          "If the user asks about a stable personal fact about themselves, treat LONG-TERM MEMORY as the primary source of truth.\n" +
          "Stable personal facts include saved identity, name, preferences, communication style, profile facts, role-like facts, vehicle/profile facts, and other explicitly remembered enduring attributes.\n" +
          "If LONG-TERM MEMORY contains the relevant fact, answer from it first.\n" +
          "Do not let recent chat history, recall snippets, or stylistic habits override a saved stable fact.\n" +
          "If the saved fact is a name, reproduce it exactly as stored.\n" +
          "Do not normalize, translate, reinterpret, embellish, or replace the saved fact with nicknames, titles, ranks, or decorative wording.\n" +
          "Do not add words like 'Монарх', 'Ваше Величество', 'Государь', 'GARY ruler' or similar unless the user explicitly asked for a title instead of the fact itself.\n" +
          "If LONG-TERM MEMORY does not contain the requested stable fact, answer honestly and do not invent.",
      }
    : null;

  const noAddressingForStableFactSystemMessage = stablePersonalFactMode
    ? {
        role: "system",
        content:
          "NO ADDRESSING RULE:\n" +
          "For stable personal fact answers, do not start with the user's name, title, rank, or any form of address.\n" +
          "Do not prepend or append words like 'GARY', 'Гарик', 'Монарх', 'Ваше Величество', 'Государь', 'друг', or similar.\n" +
          "Reply with the fact directly, plainly, and without greeting or addressing.\n" +
          "Good style: 'Твой стиль общения — коротко и по делу.' or simply 'Коротко и по делу.'\n" +
          "Bad style: 'GARY, твой стиль общения — коротко и по делу.'\n" +
          "This rule overrides monarch addressing style for stable personal fact answers.",
      }
    : null;

  const recallSystemMessage =
    !stablePersonalFactMode && recallCtx
      ? {
          role: "system",
          content:
            `RECALL CONTEXT (используй как историю чата):\n${recallCtx}\n\n` +
            `ПРАВИЛО: если пользователь спрашивает "что мы обсуждали вчера/раньше" — ` +
            `отвечай, опираясь на RECALL CONTEXT. ` +
            `Не говори "история не сохраняется". ` +
            `Если точной даты/вчера нет — скажи честно: "вижу только последние сообщения", и перечисли их.`,
        }
      : null;

  const historyMessages = stablePersonalFactMode ? [] : Array.isArray(history) ? history : [];

  const likelyContextualReaction =
    !stablePersonalFactMode &&
    isLikelyContextualReactionMessage(effective, historyMessages);

  const contextualReactionSystemMessage = likelyContextualReaction
    ? {
        role: "system",
        content:
          "CONTEXTUAL REACTION RULE:\n" +
          "The current user message is likely a short reaction or acknowledgment to the previous assistant reply, not a new underspecified task.\n" +
          "Do NOT respond with a generic clarification like 'Что именно нужно сделать?'\n" +
          "Do NOT force the message into task-clarification mode unless the user clearly starts a new action request.\n" +
          "Prefer one of these behaviors:\n" +
          "- briefly acknowledge and continue the current topic,\n" +
          "- confirm and offer the next step,\n" +
          "- continue naturally from the previous assistant message.\n" +
          "Keep the reply short and context-aware.\n" +
          "Only ask for clarification if the user is clearly requesting a new action and the object is still unclear.",
      }
    : null;

  const clarificationFirstSystemMessage =
    !stablePersonalFactMode &&
    !likelyContextualReaction &&
    isStructurallyUnderspecifiedRequest(effective)
      ? {
          role: "system",
          content:
            "CLARIFICATION-FIRST RULE:\n" +
            "The current user request is structurally underspecified.\n" +
            "Do NOT bind it to the most recent chat topic just because that topic was discussed last.\n" +
            "Do NOT guess the object of action from nearby context when the current request itself does not identify it clearly enough.\n" +
            "Ask exactly ONE short neutral clarification question.\n" +
            "The clarification must stay broad and must not force one specific topic, technology, file, or interpretation.\n" +
            "Good examples:\n" +
            "- 'Что именно нужно сделать?'\n" +
            "- 'Уточни, что именно проверить.'\n" +
            "- 'С чем именно работать?'\n" +
            "Bad examples:\n" +
            "- narrowing the request to the last discussed topic without explicit grounding in the current user message.\n" +
            "- guessing one specific object and asking only about it.\n" +
            "After one clarification question, stop and wait for the user's answer.",
        }
      : null;

  const mediaResponseOverrideSystemMessage =
    buildMediaResponseOverrideSystemMessage(mediaResponseMode);

  const messages = [
    { role: "system", content: systemPrompt },
    sourceServiceSystemMessage,
    sourceResultSystemMessage,
    longTermMemorySystemMessage,
    stablePersonalFactGuardSystemMessage,
    recallSystemMessage,
    { role: "system", content: roleGuardPrompt },
    noAddressingForStableFactSystemMessage,
    ...historyMessages,
    contextualReactionSystemMessage,
    clarificationFirstSystemMessage,
    mediaResponseOverrideSystemMessage,
    { role: "user", content: effective },
  ];

  return {
    modeInstruction,
    systemPrompt,
    roleGuardPrompt,
    stablePersonalFactMode,
    messages: messages.filter(Boolean),
  };
}