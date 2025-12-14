// src/bot/messageRouter.js
// Главный обработчик входящих сообщений (текст/команды/вложения) → память → ИИ → ответ.

import { ensureUserProfile } from "../users/userProfile.js";
import { getAnswerMode } from "../../core/answerMode.js";
import { loadProjectContext } from "../../core/projectContext.js";
import { buildSystemPrompt } from "../../systemPrompt.js";

import { classifyInteraction } from "../../classifier.js";
import { callAI } from "../../ai.js";

import { getChatHistory, saveMessageToMemory, saveChatPair } from "../memory/chatMemory.js";

import * as FileIntake from "../media/fileIntake.js";
import { logInteraction } from "../logging/interactionLogs.js";
import { handleCommand } from "./commands.js";

const MAX_HISTORY_MESSAGES = 20;

function parseTelegramCommand(text) {
  const t = (text || "").trim();
  if (!t.startsWith("/")) return null;
  const firstSpace = t.indexOf(" ");
  const cmd = firstSpace === -1 ? t : t.slice(0, firstSpace);
  const args = firstSpace === -1 ? "" : t.slice(firstSpace + 1).trim();
  return { cmd, args };
}

async function callAICompat(messages, costLevel, opts) {
  // поддержка двух сигнатур:
  // callAI(messages, opts) или callAI(messages, costLevel, opts)
  try {
    if (typeof callAI !== "function") throw new Error("callAI is not a function");
    if (callAI.length >= 3) return await callAI(messages, costLevel, opts);
    return await callAI(messages, opts);
  } catch (e) {
    throw e;
  }
}

export async function handleIncomingMessage(bot, msg) {
  if (!msg?.chat?.id) return;

  const chatId = msg.chat.id;
  const chatIdStr = String(chatId);

  // 1) Профиль пользователя (users table)
  await ensureUserProfile(msg);

  const text = msg.text || "";

  // 2) Команды — строго через commands.js
  const parsed = parseTelegramCommand(text);
  if (parsed) {
    await handleCommand(bot, msg, parsed.cmd, parsed.args);
    return;
  }

  // 3) File-Intake: summary + decision (если есть), иначе fallback
  const trimmed = (text || "").trim();

  const summarizeMediaAttachment =
    typeof FileIntake.summarizeMediaAttachment === "function"
      ? FileIntake.summarizeMediaAttachment
      : () => null;

  const buildDecision =
    typeof FileIntake.buildEffectiveUserTextAndDecision === "function"
      ? FileIntake.buildEffectiveUserTextAndDecision
      : null;

  const mediaSummary = summarizeMediaAttachment(msg);

  const decision = buildDecision
    ? buildDecision(trimmed, mediaSummary)
    : {
        effectiveUserText: trimmed,
        shouldCallAI: Boolean(trimmed) || Boolean(mediaSummary),
        directReplyText: !trimmed && mediaSummary ? "Пришли текстом, что нужно сделать с файлом." : null,
      };

  const effective = String(decision?.effectiveUserText || "").trim();
  const shouldCallAI = Boolean(decision?.shouldCallAI);
  const directReplyText = decision?.directReplyText || null;

  if (directReplyText) {
    await bot.sendMessage(chatId, directReplyText);
    return;
  }

  if (!shouldCallAI || !effective) {
    await bot.sendMessage(chatId, "Напиши текстом, что нужно сделать.");
    return;
  }

  // 4) Память: сохраняем user
  await saveMessageToMemory(chatIdStr, "user", effective);

  // 5) История
  const history = await getChatHistory(chatIdStr, MAX_HISTORY_MESSAGES);

  // 6) Классификация (V0)
  const classification = classifyInteraction(effective) || { taskType: "chat", aiCostLevel: "high" };
  await logInteraction(chatIdStr, classification);

  // 7) Project-context + systemPrompt
  const projectCtx = await loadProjectContext();
  const answerMode = getAnswerMode(chatIdStr);

  let modeInstruction = "";
  if (answerMode === "short") {
    modeInstruction = "Режим short: отвечай очень кратко (1–2 предложения), только по существу.";
  } else if (answerMode === "normal") {
    modeInstruction = "Режим normal: 3–7 предложений, ключевые детали без воды.";
  } else if (answerMode === "long") {
    modeInstruction = "Режим long: подробно и структурированно, можно пунктами и с примерами.";
  }

  const systemPrompt = buildSystemPrompt(answerMode, modeInstruction, projectCtx || "");

  const messages = [
    { role: "system", content: systemPrompt },
    ...history, // ожидается [{role, content}]
    { role: "user", content: effective },
  ];

  // 8) Параметры ответа
  let maxTokens = 350;
  let temperature = 0.6;
  if (answerMode === "short") {
    maxTokens = 150;
    temperature = 0.3;
  } else if (answerMode === "long") {
    maxTokens = 900;
    temperature = 0.8;
  }

  // 9) AI call
  let aiReply = "";
  try {
    aiReply = await callAICompat(messages, classification.aiCostLevel || "high", {
      max_output_tokens: maxTokens,
      temperature,
    });
  } catch (err) {
    console.error("❌ Error calling AI:", err);
    aiReply = "⚠️ Ошибка вызова ИИ. Попробуйте ещё раз.";
  }

  // 10) Память: сохраняем пару
  await saveChatPair(chatIdStr, effective, aiReply);

  // 11) Ответ в Telegram
  try {
    await bot.sendMessage(chatId, aiReply);
  } catch (err) {
    console.error("❌ Telegram send error:", err);
  }
}
