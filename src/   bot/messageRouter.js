// bot/messageRouter.js
// Главный обработчик всех входящих сообщений Telegram.
// Включает обработку команд, вложений, обычного текста, классификацию,
// вызов ИИ и запись сообщений в долговременную память.

import { ensureUserProfile } from "../users/userProfile.js";
import { getAnswerMode } from "../core/answerMode.js";
import { classifyInteraction } from "../classifier.js";
import { callAI } from "../ai.js";
import {
  getChatHistory,
  saveMessageToMemory,
  saveChatPair,
} from "../memory/chatMemory.js";
import { describeMediaAttachments } from "../media/fileIntake.js";
import { logInteraction } from "../logging/interactionLogs.js";
import { handleCommand } from "./commands.js";

export async function handleIncomingMessage(bot, msg) {
  if (!msg || !msg.chat || !msg.chat.id) return;

  const chatId = msg.chat.id;
  const chatIdStr = chatId.toString();

  // 1) Обновляем профиль пользователя
  await ensureUserProfile(msg);

  // 2) Выясняем, есть ли команда
  const text = msg.text || "";
  const firstSpace = text.indexOf(" ");
  const command =
    text.startsWith("/") && firstSpace !== -1
      ? text.slice(0, firstSpace)
      : text.startsWith("/")
      ? text
      : null;
  const commandArgs =
    text.startsWith("/") && firstSpace !== -1
      ? text.slice(firstSpace + 1).trim()
      : "";

  // 2.1) Если команда — обрабатываем в commands.js
  if (command) {
    await handleCommand(bot, msg, command, commandArgs);
    return;
  }

  // 3) Медиа-вложения (фото, видео и т.п.)
  const mediaDescription = describeMediaAttachments(msg);

  // 4) Сохраняем пользовательский текст в память
  const userTextRaw = text || "";
  const userTextFinal = mediaDescription
    ? `${userTextRaw}\n\n${mediaDescription}`
    : userTextRaw;

  await saveMessageToMemory(chatIdStr, "user", userTextFinal);

  // 5) Классификация сообщения
  const classification = classifyInteraction(userTextFinal);
  await logInteraction(chatIdStr, classification);

  const answerMode = getAnswerMode(chatIdStr);

  // 6) Берём историю чата
  const history = await getChatHistory(chatIdStr);

  const messages = [
    { role: "system", content: "Ты — Советник GARYA. Следуй ТЗ и режимам ответа." },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  messages.push({ role: "user", content: userTextFinal });

  // 7) Параметры модели
  let maxTokens = 400;
  let temperature = 0.6;

  if (answerMode === "short") {
    maxTokens = 180;
    temperature = 0.3;
  } else if (answerMode === "normal") {
    maxTokens = 450;
    temperature = 0.6;
  } else if (answerMode === "long") {
    maxTokens = 900;
    temperature = 0.8;
  }

  // 8) Вызов ИИ
  let aiReply = "";
  try {
    aiReply = await callAI(messages, {
      max_output_tokens: maxTokens,
      temperature,
    });
  } catch (err) {
    console.error("❌ Error calling AI:", err);
    aiReply =
      "⚠️ Ошибка вызова ИИ. Возможно, временная проблема. Попробуйте ещё раз.";
  }

  // 9) Сохраняем связку (user + assistant)
  await saveChatPair(chatIdStr, userTextFinal, aiReply);

  // 10) Отправляем ответ
  try {
    await bot.sendMessage(chatId, aiReply);
  } catch (err) {
    console.error("❌ Telegram send error:", err);
  }
}

