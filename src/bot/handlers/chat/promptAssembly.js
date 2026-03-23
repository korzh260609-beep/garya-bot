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

  const messages = [
    { role: "system", content: systemPrompt },
    sourceServiceSystemMessage,
    sourceResultSystemMessage,
    longTermMemorySystemMessage,
    stablePersonalFactGuardSystemMessage,
    recallSystemMessage,
    { role: "system", content: roleGuardPrompt },
    ...historyMessages,
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