// src/bot/handlers/chat.js
// extracted from messageRouter.js — minimal changes:
// - safety-guards (callAI / isMonarch / FileIntake)
// - never crash on DB/memory failures
// - monarch gets brief real error text

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
  const safeSend = async (text) => {
    try {
      await bot.sendMessage(chatId, text);
    } catch (e) {
      console.error("❌ Telegram send error:", e);
    }
  };

  // ---- GUARDS (critical): never crash on wrong wiring ----
  const isMonarchFn = typeof isMonarch === "function" ? isMonarch : () => false;
  const monarchNow = isMonarchFn(senderIdStr);

  if (typeof callAI !== "function") {
    const details =
      "callAI is not a function (router wiring error: pass { callAI } into handleChatMessage).";
    await safeSend(
      monarchNow ? `⚠️ Ошибка конфигурации: ${details}` : "⚠️ Ошибка вызова ИИ."
    );
    return;
  }

  const sanitizeFn =
    typeof sanitizeNonMonarchReply === "function"
      ? sanitizeNonMonarchReply
      : (x) => x;

  const messageId = msg?.message_id ?? null;

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
    await safeSend(directReplyText);
    return;
  }

  if (!shouldCallAI) {
    await safeSend("Напиши текстом, что нужно сделать.");
    return;
  }

  // --- memory (must not block reply) ---
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
    projectCtx = (await loadProjectContext()) || "";
  } catch (e) {
    console.error("❌ loadProjectContext error:", e);
  }

  let answerMode = "normal";
  try {
    answerMode = getAnswerMode(chatIdStr) || "normal";
  } catch (e) {
    console.error("❌ getAnswerMode error:", e);
  }

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
    projectCtx,
    { isMonarch: monarchNow, currentUserName }
  );

  const roleGuardPrompt = bypass
    ? "SYSTEM ROLE: текущий пользователь = MONARCH (разрешено обращаться 'Монарх', 'Гарик')."
    : "SYSTEM ROLE: текущий пользователь НЕ монарх. Запрещено обращаться 'Монарх', 'Ваше Величество', 'Государь'. Называй: 'гость' или нейтрально (вы/ты).";

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "system", content: roleGuardPrompt },
    ...(Array.isArray(history) ? history : []),
    { role: "user", content: effective },
  ];

  let maxOut = 350;
  let temperature = 0.6;
  if (answerMode === "short") {
    maxOut = 150;
    temperature = 0.3;
  } else if (answerMode === "long") {
    maxOut = 900;
    temperature = 0.8;
  }

  let aiReply = "";
  try {
    // IMPORTANT: use max_output_tokens (not max_tokens) for gpt-5.1
    aiReply = await callAI(messages, classification.aiCostLevel, {
      max_output_tokens: maxOut,
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
    if (!bypass) aiReply = sanitizeFn(aiReply);
  } catch (e) {
    console.error("❌ sanitizeNonMonarchReply error:", e);
  }

  await safeSend(aiReply);
}
