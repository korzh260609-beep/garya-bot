// src/bot/handlers/chat.js

import pool from "../../../db.js";
import { insertAssistantMessage } from "../../db/chatMessagesRepo.js";
import { getMemoryService } from "../../core/memoryServiceFactory.js";
import { getRecallEngine } from "../../core/recallEngineFactory.js";
import { getAlreadySeenDetector } from "../../core/alreadySeenFactory.js";
import { createTimeContext } from "../../core/time/timeContextFactory.js";
import { isTimeNowIntent } from "../../core/time/timeNowIntent.js";
import { isCurrentDateIntent } from "../../core/time/currentDateIntent.js";
import { touchChatMeta } from "../../db/chatMeta.js";
import { redactText, sha256Text } from "../../core/redaction.js";
import { getUserTimezone, setUserTimezone } from "../../db/userSettings.js";
import BehaviorEventsService from "../../logging/BehaviorEventsService.js";
import { runDecisionShadowHook } from "../../decision/decisionShadowHook.js";
import { routeDecision } from "../../decision/index.js";

export async function handleChatMessage({
  bot,
  msg,
  chatId,
  chatIdStr,
  senderIdStr,
  trimmed,
  bypass,
  MAX_HISTORY_MESSAGES = 20,
  globalUserId = null,
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
  if (!trimmed) return;

  const MAX_CHAT_MESSAGE_CHARS = 16000;

  const isMonarchFn = typeof isMonarch === "function" ? isMonarch : () => false;
  const monarchNow = isMonarchFn(senderIdStr);

  const memory = getMemoryService ? getMemoryService() : null;

  const memoryWrite = async ({ role, content, transport, metadata, schemaVersion }) => {
    try {
      if (memory && typeof memory.write === "function") {
        return await memory.write({
          chatId: chatIdStr,
          globalUserId,
          role,
          content: String(content ?? ""),
          transport: transport || "telegram",
          metadata: metadata || {},
          schemaVersion: schemaVersion || 2,
        });
      }
    } catch (e) {
      console.error("MemoryService.write failed:", e);
    }

    if (typeof saveMessageToMemory === "function") {
      return saveMessageToMemory(chatIdStr, role, content, {
        globalUserId,
        transport: "telegram",
        metadata,
        schemaVersion: 2,
      });
    }

    return { ok: true };
  };

  const memoryWritePair = async ({ userText, assistantText }) => {
    try {
      if (memory && typeof memory.writePair === "function") {
        return memory.writePair({
          chatId: chatIdStr,
          globalUserId,
          userText,
          assistantText,
          transport: "telegram",
        });
      }
    } catch (e) {
      console.error("MemoryService.writePair failed:", e);
    }

    if (typeof saveChatPair === "function") {
      return saveChatPair(chatIdStr, userText, assistantText, {
        globalUserId,
        transport: "telegram",
      });
    }

    return { ok: true };
  };

  if (typeof callAI !== "function") {
    await bot.sendMessage(chatId, "ERROR: AI not configured.");
    return;
  }

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
const userRedactedFull = redactText(effective);

  const userContentForDb =
    userRedactedFull.length > MAX_CHAT_MESSAGE_CHARS
      ? userRedactedFull.slice(0, MAX_CHAT_MESSAGE_CHARS)
      : userRedactedFull;

  const userTruncatedForDb =
    userRedactedFull.length > MAX_CHAT_MESSAGE_CHARS;

  const userTextHash = sha256Text(userRedactedFull);

  const saveAssistantEarlyReturn = async (text) => {
    const replyText = String(text ?? "");

    const assistantRedactedFull = redactText(replyText);
    const assistantTextHash = sha256Text(assistantRedactedFull);

    const assistantContentForDb =
      assistantRedactedFull.length > MAX_CHAT_MESSAGE_CHARS
        ? assistantRedactedFull.slice(0, MAX_CHAT_MESSAGE_CHARS)
        : assistantRedactedFull;

    await insertAssistantMessage({
      transport: "telegram",
      chatId: chatIdStr,
      chatType: msg?.chat?.type || null,
      globalUserId,
      textHash: assistantTextHash,
      content: assistantContentForDb,
      truncated: false,
      metadata: {
        handler: "chat",
        earlyReturn: true,
      },
      schemaVersion: 1,
    });

    await memoryWrite({
      role: "assistant",
      content: replyText,
      transport: "telegram",
    });
  };

  if (directReplyText) {
    await saveAssistantEarlyReturn(directReplyText);
    await bot.sendMessage(chatId, directReplyText);
    return;
  }

  if (!shouldCallAI) {
    const text = "Напиши текстом, что нужно сделать.";
    await saveAssistantEarlyReturn(text);
    await bot.sendMessage(chatId, text);
    return;
  }

  await memoryWrite({
    role: "user",
    content: effective,
    transport: "telegram",
    metadata: { senderIdStr, chatIdStr, messageId },
  });

  let history = [];
  try {
    const memory = getMemoryService();
    history = await memory.recent({
      chatId: chatIdStr,
      globalUserId,
      limit: MAX_HISTORY_MESSAGES,
    });
  } catch (e) {
    console.error("memory.recent error:", e);
  }

  const classification = { taskType: "chat", aiCostLevel: "low" };

  let projectCtx = "";
  try {
    projectCtx = await loadProjectContext();
  } catch (e) {
    console.error("loadProjectContext error:", e);
  }

  const answerMode = getAnswerMode(chatIdStr, {
    isMonarch: monarchNow,
    text: effective,
    taskType: classification.taskType,
  });

  const currentUserName =
    [msg?.from?.first_name, msg?.from?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    (msg?.from?.username ? `@${msg.from.username}` : "user");

  const systemPrompt = buildSystemPrompt(answerMode, "", projectCtx || "", {
    isMonarch: monarchNow,
    currentUserName,
  });

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: effective },
  ];
let aiReply = "";

  try {
    aiReply = await callAI(messages, classification.aiCostLevel);
  } catch (e) {
    console.error("AI error:", e);
    aiReply = "ERROR: Ошибка вызова ИИ.";
  }

  try {
    const assistantRedactedFull = redactText(aiReply);
    const assistantTextHash = sha256Text(assistantRedactedFull);

    await insertAssistantMessage({
      transport: "telegram",
      chatId: chatIdStr,
      chatType: msg?.chat?.type || null,
      globalUserId,
      textHash: assistantTextHash,
      content: assistantRedactedFull,
      truncated: false,
      metadata: {
        senderIdStr,
        chatIdStr,
        handler: "chat",
        stage: "7B.reply",
      },
      schemaVersion: 1,
    });

    await touchChatMeta({
      transport: "telegram",
      chatId: String(chatIdStr),
      chatType: msg?.chat?.type || null,
      title: msg?.chat?.title || null,
      role: "assistant",
    });

  } catch (e) {
    console.error("assistant insert failed:", e);
  }

  await memoryWritePair({
    userText: effective,
    assistantText: aiReply,
  });

  if (!monarchNow) {
    try {
      aiReply = sanitizeNonMonarchReply(aiReply);
    } catch (e) {
      console.error("sanitize error:", e);
    }
  }

  await bot.sendMessage(chatId, aiReply);

  try {
    await runDecisionShadowHook(
      {
        goal: effective,
        text: effective,
        transport: "telegram",
        userId: senderIdStr,
        chatId: chatIdStr,
        messageId,
        globalUserId,
      },
      {
        finalText: aiReply,
        route: { kind: "core_chat" },
        warnings: [],
      }
    );
  } catch (e) {
    console.error("DecisionShadowHook failed:", e);
  }
}