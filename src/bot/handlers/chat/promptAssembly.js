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

function normalizeText(value) {
  return safeStr(value).trim().toLowerCase();
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function looksLikeQuestion(text) {
  if (!text) return false;

  return (
    text.includes("?") ||
    hasAny(text, [
      /^(как|какой|какая|какие|каково|кто|что|где|почему|зачем|сколько)\b/i,
      /^(what|who|which|where|why|how)\b/i,
      /\bскажи\b/i,
      /\bнапомни\b/i,
      /\btell me\b/i,
      /\bremind me\b/i,
      /\bdo you remember\b/i,
    ])
  );
}

function refersToUserSelf(text) {
  if (!text) return false;

  return hasAny(text, [
    /\bя\b/i,
    /\bменя\b/i,
    /\bмне\b/i,
    /\bмой\b/i,
    /\bмоя\b/i,
    /\bмоё\b/i,
    /\bмое\b/i,
    /\bмои\b/i,
    /\bу меня\b/i,
    /\bобо мне\b/i,
    /\bпро меня\b/i,
    /\bmy\b/i,
    /\bme\b/i,
    /\bi\b/i,
    /\babout me\b/i,
  ]);
}

function isTemporalOrSessionBoundQuestion(text) {
  if (!text) return false;

  return hasAny(text, [
    /\bсейчас\b/i,
    /\bсегодня\b/i,
    /\bвчера\b/i,
    /\bзавтра\b/i,
    /\bнедавно\b/i,
    /\bтолько что\b/i,
    /\bмы обсуждали\b/i,
    /\bмы говорили\b/i,
    /\bв этом чате\b/i,
    /\blast message\b/i,
    /\btoday\b/i,
    /\byesterday\b/i,
    /\brecent\b/i,
    /\bin this chat\b/i,
  ]);
}

function isActionRequest(text) {
  if (!text) return false;

  return hasAny(text, [
    /\bсделай\b/i,
    /\bсоздай\b/i,
    /\bнапиши\b/i,
    /\bпереведи\b/i,
    /\bпокажи\b/i,
    /\bнайди\b/i,
    /\bрасскажи\b/i,
    /\banalyze\b/i,
    /\bcreate\b/i,
    /\bwrite\b/i,
    /\bfind\b/i,
    /\bshow\b/i,
    /\btranslate\b/i,
  ]);
}

function mentionsStableFactDomain(text) {
  if (!text) return false;

  return hasAny(text, [
    /\bимя\b/i,
    /\bзовут\b/i,
    /\bname\b/i,
    /\bstyle\b/i,
    /\bстиль\b/i,
    /\bпредпочита/i,
    /\bpreference\b/i,
    /\bроль\b/i,
    /\brole\b/i,
    /\bпрофиль\b/i,
    /\bprofile\b/i,
    /\bмашин/i,
    /\bавто\b/i,
    /\bcar\b/i,
    /\bfreelander\b/i,
  ]);
}

function isStablePersonalFactQuestion(text) {
  const normalized = normalizeText(text);

  if (!normalized) return false;
  if (!looksLikeQuestion(normalized)) return false;
  if (!refersToUserSelf(normalized)) return false;
  if (isTemporalOrSessionBoundQuestion(normalized)) return false;
  if (isActionRequest(normalized)) return false;

  // Консервативно:
  // либо явно есть домен стабильного факта,
  // либо это короткий вопрос о себе без признаков временного/операционного запроса.
  if (mentionsStableFactDomain(normalized)) return true;

  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length <= 10;
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