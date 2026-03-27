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

  // IMPORTANT:
  // - no meaning/keyword lists
  // - only structural underspecification
  // - conservative on purpose
  return shortByChars && shortByWords && lowStructure;
}

export function buildChatMessages({
  buildSystemPrompt,
  answerMode,
  projectCtx,
  monarchNow,
  msg,
  effective,
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

  const clarificationFirstSystemMessage =
    !stablePersonalFactMode && isStructurallyUnderspecifiedRequest(effective)
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
    clarificationFirstSystemMessage,
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