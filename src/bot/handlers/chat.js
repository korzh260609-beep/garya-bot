// src/bot/handlers/chat.js
// extracted from messageRouter.js — no logic changes

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

  const summarizeMediaAttachment =
    typeof FileIntake.summarizeMediaAttachment === "function"
      ? FileIntake.summarizeMediaAttachment
      : () => null;

  const mediaSummary = summarizeMediaAttachment(msg);

  const decisionFn =
    typeof FileIntake.buildEffectiveUserTextAndDecision === "function"
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
    await bot.sendMessage(chatId, directReplyText);
    return;
  }

  if (!shouldCallAI) {
    await bot.sendMessage(chatId, "Напиши текстом, что нужно сделать.");
    return;
  }

  await saveMessageToMemory(chatIdStr, "user", effective);
  const history = await getChatHistory(chatIdStr, MAX_HISTORY_MESSAGES);

  const classification = { taskType: "chat", aiCostLevel: "low" };
  await logInteraction(chatIdStr, classification);

  const projectCtx = await loadProjectContext();
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
    [msg?.from?.first_name, msg?.from?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    (msg?.from?.username ? `@${msg.from.username}` : "пользователь");

  const systemPrompt = buildSystemPrompt(
    answerMode,
    modeInstruction,
    projectCtx || "",
    { isMonarch: isMonarch(senderIdStr), currentUserName }
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
    aiReply = await callAI(messages, classification.aiCostLevel, {
      max_output_tokens: maxTokens,
      temperature,
    });
  } catch (e) {
    console.error("❌ AI error:", e);

    // ВАЖНО: монарху показываем краткую реальную причину (для дебага),
    // всем остальным — как раньше общая ошибка.
    const monarch = typeof isMonarch === "function" ? isMonarch(senderIdStr) : false;
    const msgText = e?.message ? String(e.message) : "unknown";

    aiReply = monarch
      ? `⚠️ Ошибка вызова ИИ: ${msgText}`
      : "⚠️ Ошибка вызова ИИ.";
  }

  await saveChatPair(chatIdStr, effective, aiReply);

  try {
    if (!bypass) aiReply = sanitizeNonMonarchReply(aiReply);
    await bot.sendMessage(chatId, aiReply);
  } catch (e) {
    console.error("❌ Telegram send error:", e);
  }
}
