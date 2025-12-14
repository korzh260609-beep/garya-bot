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

// ✅ V1 continuation window: если пользователь прислал фото, а затем текст — считаем это продолжением
const MEDIA_FOLLOWUP_WINDOW_MS = 3 * 60 * 1000;

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
  if (typeof callAI !== "function") throw new Error("callAI is not a function");
  if (callAI.length >= 3) return await callAI(messages, costLevel, opts);
  return await callAI(messages, opts);
}

// ✅ эвристика: распознаём наш stub (и новый, и старый текст)
function isMediaStubText(s) {
  const t = String(s || "");
  if (!t) return false;
  return (
    t.includes("OCR/Vision анализ будет добавлен") ||
    t.includes("OCR/Vision ещё нет") ||
    t.includes("ещё не включ") ||
    t.includes("Фото получено.") ||
    t.includes("📸 Фото получено.")
  );
}

// ✅ общий вопрос "про картинку" (без деталей) → дадим soft-ответ
function isGeneralPhotoQuestion(text) {
  const t = String(text || "").toLowerCase();
  if (!t) return false;

  // короткие и частые формулировки
  if (t.includes("что на фото")) return true;
  if (t.includes("кто на фото")) return true;
  if (t.includes("на фото человек")) return true;
  if (t.includes("это человек")) return true;
  if (t.includes("что он держит")) return true;
  if (t.includes("что держит")) return true;
  if (t.includes("что изображено")) return true;
  if (t === "что?" || t === "кто?" || t === "что это?") return true;

  return false;
}

function buildSoftNoVisionReply() {
  return (
    "Я не вижу изображение напрямую (Vision/OCR ещё не активен). " +
    "Могу помочь, если ты опишешь, что на фото, или скажешь, что именно нужно определить: " +
    "человек/предметы/что держит/надписи/эмблемы/детали экипировки."
  );
}

function withinWindow(dateStr, msWindow) {
  if (!dateStr) return false;
  const dt = new Date(dateStr).getTime();
  if (!Number.isFinite(dt)) return false;
  return Date.now() - dt <= msWindow;
}

export async function handleIncomingMessage(bot, msg) {
  if (!msg?.chat?.id) return;

  const chatId = msg.chat.id;
  const chatIdStr = String(chatId);

  // 1) Профиль пользователя (users table)
  await ensureUserProfile(msg);

  // ✅ Telegram: текст может быть и в caption
  const rawText = (msg.text || msg.caption || "").toString();
  const text = rawText;
  const trimmed = (text || "").trim();

  // 2) Команды — строго через commands.js (только msg.text)
  // caption-команды не поддерживаем, чтобы не ломать UX
  const parsed = parseTelegramCommand(msg.text || "");
  if (parsed) {
    await handleCommand(bot, msg, parsed.cmd, parsed.args);
    return;
  }

  // 3) File-Intake: summary + decision (если есть), иначе fallback
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
        directReplyText: !trimmed && mediaSummary
          ? "Пришли текстом, что нужно сделать с файлом."
          : null,
      };

  let effective = String(decision?.effectiveUserText || "").trim();
  let shouldCallAI = Boolean(decision?.shouldCallAI);
  let directReplyText = decision?.directReplyText || null;

  // Флаг: недавно было медиа (даже если текущий msg без вложения)
  let hasRecentMediaContext = Boolean(mediaSummary);

  // ✅ FIX: если это текст сразу после media-stub (в пределах окна) → форсим контекст "после фото"
  if (!mediaSummary && trimmed) {
    try {
      const recent = await getChatHistory(chatIdStr, 6);

      const lastAssistantStub = recent
        .slice()
        .reverse()
        .find((m) => (m?.role === "assistant") && isMediaStubText(m?.content));

      const createdAt =
        lastAssistantStub?.created_at ||
        lastAssistantStub?.createdAt ||
        lastAssistantStub?.timestamp ||
        null;

      const okByTime = createdAt ? withinWindow(createdAt, MEDIA_FOLLOWUP_WINDOW_MS) : true;

      if (lastAssistantStub && okByTime) {
        hasRecentMediaContext = true;

        // ВАЖНО: не обязаны звать AI — для общего вопроса дадим soft-ответ ниже
        directReplyText = null;
        shouldCallAI = true;

        effective = `${trimmed}\n\n(Контекст: предыдущее сообщение было с фото; Vision/OCR пока не активен.)`;
      }
    } catch (e) {
      console.error("❌ continuation check error:", e);
    }
  }

  // ✅ SOFT: если вопрос общий и контекст фото есть — отвечаем полезно, без повтора OCR-отказа
  // (дешево: без callAI)
  if (hasRecentMediaContext && trimmed && isGeneralPhotoQuestion(trimmed)) {
    directReplyText = buildSoftNoVisionReply();
    shouldCallAI = false; // чтобы не дергать ИИ зря
    effective = ""; // не нужно
  }

  // Если File-Intake вернул stub — показываем его (как раньше)
  if (directReplyText) {
    await bot.sendMessage(chatId, directReplyText);

    // ✅ важно: сохраняем stub/soft в память как assistant
    await saveMessageToMemory(chatIdStr, "assistant", directReplyText);

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
  const classification =
    classifyInteraction(effective) || { taskType: "chat", aiCostLevel: "high" };
  await logInteraction(chatIdStr, classification);

  // 7) Project-context + systemPrompt
  const projectCtx = await loadProjectContext();
  const answerMode = getAnswerMode(chatIdStr);

  let modeInstruction = "";
  if (answerMode === "short") {
    modeInstruction =
      "Режим short: отвечай очень кратко (1–2 предложения), только по существу.";
  } else if (answerMode === "normal") {
    modeInstruction =
      "Режим normal: 3–7 предложений, ключевые детали без воды.";
  } else if (answerMode === "long") {
    modeInstruction =
      "Режим long: подробно и структурированно, можно пунктами и с примерами.";
  }

  const systemPrompt = buildSystemPrompt(
    answerMode,
    modeInstruction,
    projectCtx || ""
  );

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
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
