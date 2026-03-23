// src/bot/handlers/chat/promptAssembly.js

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

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function isIdentityMemoryQuestion(text) {
  const normalized = safeStr(text).trim().toLowerCase();

  if (!normalized) return false;

  const patterns = [
    /как меня зовут\??$/i,
    /какое у меня имя\??$/i,
    /ты помнишь как меня зовут\??$/i,
    /what is my name\??$/i,
    /do you remember my name\??$/i,
    /who am i\??$/i,
  ];

  return patterns.some((pattern) => pattern.test(normalized));
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

  const identityMemoryMode = isIdentityMemoryQuestion(effective);

  const identityMemoryGuardSystemMessage =
    identityMemoryMode && longTermMemorySystemMessage
      ? {
          role: "system",
          content:
            "IDENTITY MEMORY RULE:\n" +
            "If the user asks about their saved name or another stable identity fact, use LONG-TERM MEMORY as the primary source of truth.\n" +
            "Reply with the saved fact directly and plainly.\n" +
            "Do not add titles, ranks, honorifics, or decorative wording to the factual answer.\n" +
            "Do not add words like 'Монарх', 'Ваше Величество', 'Государь', 'GARY ruler' or similar.\n" +
            "If LONG-TERM MEMORY contains a saved name, reproduce that name exactly as stored.\n" +
            "Do not normalize, translate, reinterpret, or embellish the saved name.\n" +
            "Do not prefer chat history or recall snippets over LONG-TERM MEMORY for these questions unless the user explicitly corrected the fact in the current conversation.",
        }
      : null;

  const recallSystemMessage =
    !identityMemoryMode && recallCtx
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

  const historyMessages = identityMemoryMode ? [] : Array.isArray(history) ? history : [];

  const messages = [
    { role: "system", content: systemPrompt },
    sourceServiceSystemMessage,
    sourceResultSystemMessage,
    longTermMemorySystemMessage,
    identityMemoryGuardSystemMessage,
    recallSystemMessage,
    { role: "system", content: roleGuardPrompt },
    ...historyMessages,
    { role: "user", content: effective },
  ];

  return {
    modeInstruction,
    systemPrompt,
    roleGuardPrompt,
    identityMemoryMode,
    messages: messages.filter(Boolean),
  };
}