// src/bot/handlers/chat.js
// extracted from messageRouter.js — no logic changes (only safety-guards + token param fix)

export async function handleChatMessage({
  bot,
  msg,
  chatId,
  chatIdStr,
  senderIdStr,
  trimmed,
  bypass,
  MAX_HISTORY_MESSAGES,

  FileIntake,

  saveMessageToMemory,
  getChatHistory,
  saveChatPair,

  logInteraction,

  loadProjectContext,
  getAnswerMode,
  buildSystemPrompt,
  isMonarch,

  callAI,
  sanitizeNonMonarchReply,
}) {
  const messageId = msg.message_id ?? null;

  // ---- GUARDS (critical): never crash on wrong wiring ----
  const isMonarchFn = typeof isMonarch === "function" ? isMonarch : () => false;
  const monarchNow = isMonarchFn(senderIdStr);

  if (typeof callAI !== "function") {
    const details =
      "callAI is not a function (router wiring error: pass { callAI } into handleChatMessage).";
    const text = monarchNow
      ? `⚠️ Ошибка конфигурации: ${details}`
      : "⚠️ Ошибка вызова ИИ.";

    try {
      await bot.sendMessage(chatId, text);
    } catch (e) {
      console.error("❌ Telegram send error (callAI guard):", e);
    }
    return;
  }
  // --------------------------------------------

  const summarizeMediaAttachment =
    typeof FileIntake?.summarizeMediaAttachment === "function"
      ? FileIntake.summarizeMediaAttachment
      : () => null;

  const mediaSummary = summarizeMediaAttachment(msg);

  const decisionFn =
    typeof FileIntake?.buildEffectiveUserTextAndDecision === "function"
      ? FileIntake.buildEffectiveUserTextAndDecision
      : null;

  const decision = decisionFn
    ? decisionFn(trimmed, mediaSummary)
    : {
        effectiveUserText: trimmed,
        shouldCallAI: Boolean(trimmed),
        directReplyText: Boolean(trimmed)
          ? null
          : "Напиши текстом, что нужно сделать.",
      };

  const effective = (decision?.effectiveUserText || "").trim();
  const shouldCallAI = Boolean(decision?.shouldCallAI);
  const directReplyText = decision?.directReplyText || null;

  if (directReplyText) {
    try {
      await bot.sendMessage(chatId, directReplyText);
    } catch (e) {
      console.error("❌ Telegram send error (directReplyText):", e);
    }
    return;
  }

  if (!shouldCallAI) {
    try {
      await bot.sendMessage(chatId, "Напиши текстом, что нужно сделать.");
    } catch (e) {
      console.error("❌ Telegram send error (shouldCallAI):", e);
    }
    return;
  }

  try {
    await saveMessageToMemory(chatIdStr, "user", effective);
  } catch (e) {
    console.error("❌ saveMessageToMemory error:", e);
  }

  let history = [];
  try {
    history = await getChatHistory(chatIdStr, MAX_HISTORY_MESSAGES);
  } catch (e) {
    console.error("❌ getChatHistory error:", e);
  }

  const classification = { taskType: "chat", aiCostLevel: "low" };
  try {
    await logInteraction(chatIdStr, classification);
  } catch (e) {
    console.error("❌ logInteraction error:", e);
  }

  let projectCtx = "";
  try {
    projectCtx = await loadProjectContext();
  } catch (e) {
    console.error("❌ loadProjectContext error:", e);
  }

  const answerMode = getAnswerMode(chatIdStr);

  let modeInstruction = "";
  if (answerMode === "short") {
    modeInstruction =
      "Режим short: отвечай очень кратко (1–2 предложения), только по существу, без лишних деталей.";
  } else if (answerMode === "normal") {
    modeInstruction =
      "Режим normal: давай развёрнутый, но компактный ответ (3–7 предложений), с ключевыми деталями.";
  } else if (answerMode === "long") {
    modeInstruction =
      "Режим long: можно отвечать подробно, структурированно, с примерами и пояснениями.";
  }

  const currentUserName =
    [msg?.from?.first_name, msg?.from?.last_name].filter(Boolean).join(" ").trim() ||
    (msg?.from?.username ? `@${msg.from.username}` : "пользователь");

  const systemPrompt = buildSystemPrompt(
    answerMode,
    modeInstruction,
    projectCtx || "",
    { isMonarch: monarchNow, currentUserName }
  );

  const roleGuardPrompt = bypass
    ? "SYSTEM ROLE: текущий пользователь = MONARCH (разрешено обращаться 'Монарх', 'Гарик')."
    : "SYSTEM ROLE: текущий пользователь НЕ монарх. Запрещено обращаться 'Монарх', 'Ваше Величество', 'Государь'. Называй: 'гость' или нейтрально (вы/ты).";

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "system", content: roleGuardPrompt },
    ...history,
    { role: "user", content: effective },
  ];

  let maxTokens = 350;
  let temperature = 0.6;
  if (answerMode === "short") {
    maxTokens = 150;
    temperature = 0.3;
  } else if (answerMode === "long") {
    maxTokens = 900;
    temperature = 0.8;
  }

  let aiReply = "";
  try {
    // FIX: для gpt-5.1 нельзя max_tokens → используем max_completion_tokens
    aiReply = await callAI(messages, classification.aiCostLevel, {
      max_completion_tokens: maxTokens,
      temperature,
    });
  } catch (e) {
    console.error("❌ AI error:", e);

    const msgText = e?.message ? String(e.message) : "unknown";
    aiReply = monarchNow ? `⚠️ Ошибка вызова ИИ: ${msgText}` : "⚠️ Ошибка вызова ИИ.";
  }

  try {
    await saveChatPair(chatIdStr, effective, aiReply);
  } catch (e) {
    console.error("❌ saveChatPair error:", e);
  }

  try {
    if (!bypass) aiReply = sanitizeNonMonarchReply(aiReply);
  } catch (e) {
    console.error("❌ sanitizeNonMonarchReply error:", e);
  }

  try {
    await bot.sendMessage(chatId, aiReply);
  } catch (e) {
    console.error("❌ Telegram send error:", e);
  }
}
