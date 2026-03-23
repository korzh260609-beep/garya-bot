// src/bot/handlers/chat.js
// extracted from messageRouter.js — no logic changes (only safety-guards + token param fix + observability logs)
//
// STAGE 7.2 LOGIC: pass globalUserId to chat_memory (v2 columns)
// STAGE 7 (Integrity hardening): ensure assistant replies are also saved on early-return branches
// (timezone/deterministic/guards), otherwise /memory_integrity shows missing_assistant.
//
// ✅ STAGE 7B (this patch): early-return replies + AlreadySeen hint also logged into chat_messages (assistant)
//
// ✅ STAGE 10.6 wiring:
// - SourceService may now perform first real source fetch (CoinGecko simple price)
// - fetched source result is injected into AI context only when sourceResult.ok=true
// - behavior remains fail-open: if source fails, chat still works
// - no hard source-blocking yet
//
// ✅ STAGE 10.6.x narrow robot-layer price reply:
// - for simple price intents only
// - uses sourceResult.meta.parsed directly
// - bypasses AI call when deterministic source reply is available
// - keeps fail-open behavior and does not affect non-price requests
//
// ✅ STAGE 10.6.x debug:
// - logs requestedCoinIds / requestedVs / parsed keys
// - helps diagnose why multi-coin robot reply may not trigger
//
// ✅ STAGE 11+ memory prompt bridge prep:
// - bridge is read-prepared but NOT activated into AI prompt by default
// - no response-flow change yet
// - activation must be a separate explicit step

import pool from "../../../db.js";
import { getMemoryService } from "../../core/memoryServiceFactory.js";
import { resolveFileIntakeDecision } from "./chat/fileIntakeDecision.js";
import { createChatMemoryBridge } from "./chat/memoryBridge.js";
import { createAssistantReplyPersistence } from "./chat/assistantReplyPersistence.js";
import { resolveChatSourceFlow } from "./chat/sourceFlow.js";
import { resolveLongTermMemoryBridge } from "./chat/longTermMemoryBridge.js";
import { tryBuildRobotPriceReply } from "./chat/robotPrice.js";
import {
  resolveUserTimezoneState,
  tryHandleMissingTimezoneFlow,
  tryHandleDeterministicTimeReplies,
} from "./chat/timezoneFlow.js";
import { buildChatRecallContext } from "./chat/recallFlow.js";
import { runAlreadySeenFlow } from "./chat/alreadySeenFlow.js";
import { buildChatMessages } from "./chat/promptAssembly.js";
import { resolveAiParams, executeChatAI } from "./chat/aiExecution.js";
import { finalizeChatReply } from "./chat/postReplyFlow.js";

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
  userRole = "guest",

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

  const { memory, memoryWrite, memoryWritePair } = createChatMemoryBridge({
    chatIdStr,
    globalUserId,
    saveMessageToMemory,
    saveChatPair,
    getMemoryService,
  });

  if (typeof callAI !== "function") {
    const details =
      "callAI is not a function (router wiring error: pass { callAI } into handleChatMessage).";
    let text = "ERROR: Ошибка вызова ИИ.";
    if (monarchNow) {
      text = "ERROR: Ошибка конфигурации: " + details;
    }

    try {
      await bot.sendMessage(chatId, text);
    } catch (e) {
      console.error("ERROR Telegram send error (callAI guard):", e);
    }
    return;
  }

  const {
    insertAssistantReply,
    touchAssistantChatMeta,
    saveAssistantEarlyReturn,
  } = createAssistantReplyPersistence({
    MAX_CHAT_MESSAGE_CHARS,
    chatIdStr,
    senderIdStr,
    messageId,
    globalUserId,
    msg,
    memoryWrite,
  });

  const {
    effective,
    shouldCallAI,
    directReplyText,
  } = resolveFileIntakeDecision({
    FileIntake,
    msg,
    trimmed,
  });

  const {
    sourceCtx,
    sourceResultSystemMessage,
    sourceServiceSystemMessage,
  } = await resolveChatSourceFlow({
    effective,
  });

  const {
    longTermMemoryBridgeResult,
    longTermMemorySystemMessage,
    longTermMemoryInjected,
  } = await resolveLongTermMemoryBridge({
    chatIdStr,
    globalUserId,
    memory,
  });

  if (directReplyText) {
    try {
      await saveAssistantEarlyReturn(directReplyText, "directReplyText");
      await bot.sendMessage(chatId, directReplyText);
    } catch (e) {
      console.error("ERROR Telegram send error (directReplyText):", e);
    }
    return;
  }

  if (!shouldCallAI) {
    const text = "Напиши текстом, что нужно сделать.";
    try {
      await saveAssistantEarlyReturn(text, "shouldCallAI_false");
      await bot.sendMessage(chatId, text);
    } catch (e) {
      console.error("ERROR Telegram send error (shouldCallAI):", e);
    }
    return;
  }

  try {
    await memoryWrite({
      role: "user",
      content: effective,
      transport: "telegram",
      metadata: { senderIdStr, chatIdStr, messageId },
      schemaVersion: 2,
    });
  } catch (e) {
    console.error("ERROR memoryWrite(user) error:", e);
  }

  try {
    const robotPriceReply = tryBuildRobotPriceReply({
      text: effective,
      sourceCtx,
    });

    try {
      console.info("ROBOT_PRICE_DEBUG_RESULT", {
        matched: Boolean(robotPriceReply),
        reply: robotPriceReply || null,
      });
    } catch (_) {}

    if (robotPriceReply) {
      await saveAssistantEarlyReturn(robotPriceReply, "robot_price_reply");
      await bot.sendMessage(chatId, robotPriceReply);
      return;
    }
  } catch (e) {
    console.error("ERROR robot price reply failed (fail-open):", e);
  }

  let history = [];
  try {
    const memoryLocal = getMemoryService();
    history = await memoryLocal.recent({
      chatId: chatIdStr,
      globalUserId,
      limit: MAX_HISTORY_MESSAGES,
    });
  } catch (e) {
    console.error("ERROR memory.recent error:", e);
  }

  const classification = { taskType: "chat", aiCostLevel: "low" };
  try {
    await logInteraction(chatIdStr, classification);
  } catch (e) {
    console.error("ERROR logInteraction error:", e);
  }

  let projectCtx = "";
  try {
    projectCtx = await loadProjectContext();
  } catch (e) {
    console.error("ERROR loadProjectContext error:", e);
  }

  const answerMode = getAnswerMode(chatIdStr, {
    isMonarch: monarchNow,
    text: effective,
    taskType: classification.taskType,
    aiCostLevel: classification.aiCostLevel,
  });

  const { userTz, timezoneMissing } = await resolveUserTimezoneState(globalUserId);

  if (timezoneMissing) {
    const result = await tryHandleMissingTimezoneFlow({
      effective,
      globalUserId,
      saveAssistantEarlyReturn,
      bot,
      chatId,
    });

    if (result?.handled) return;
  }

  const recallCtx = await buildChatRecallContext({
    pool,
    chatIdStr,
    globalUserId,
    effective,
    userTz,
  });

  {
    const deterministicResult = await tryHandleDeterministicTimeReplies({
      effective,
      userTz,
      recallCtx,
      saveAssistantEarlyReturn,
      bot,
      chatId,
    });

    if (deterministicResult?.handled) return;
  }

  await runAlreadySeenFlow({
    bot,
    chatId,
    chatIdStr,
    globalUserId,
    effective,
    userRole,
    saveAssistantHint: async (hintText) => {
      await insertAssistantReply(hintText, {
        stage: "7B.already_seen_hint",
      });
    },
  });

  const { messages } = buildChatMessages({
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
  });

  const { maxTokens, temperature } = resolveAiParams(answerMode);

  const aiReason = "chat.reply";
  const aiMetaBase = {
    handler: "chat",
    reason: aiReason,
    aiCostLevel: classification.aiCostLevel,
    answerMode,
    max_completion_tokens: maxTokens,
    temperature,
    chatId: chatIdStr,
    senderId: senderIdStr,
    messageId,
    globalUserId,
    sourceServiceDecision: sourceCtx?.sourcePlan?.decision || "unknown",
    sourceRuntimeDecision: sourceCtx?.sourceRuntime?.decision || "unknown",
    sourceRuntimeNeedsSource: Boolean(sourceCtx?.sourceRuntime?.needsSource),
    sourceReason: sourceCtx?.reason || "unknown",
    sourceResultOk: Boolean(sourceCtx?.sourceResult?.ok),
    sourceResultKey: sourceCtx?.sourceResult?.sourceKey || null,
    longTermMemoryBridgePrepared: Boolean(longTermMemoryBridgeResult),
    longTermMemoryBridgeOk: Boolean(longTermMemoryBridgeResult?.ok),
    longTermMemoryBridgeReason: longTermMemoryBridgeResult?.reason || null,
    longTermMemoryInjected,
  };

  const { aiReply } = await executeChatAI({
    callAI,
    filtered: messages,
    classification,
    maxTokens,
    temperature,
    monarchNow,
    logInteraction,
    aiMetaBase,
    globalUserId,
    chatIdStr,
  });

  try {
    await insertAssistantReply(typeof aiReply === "string" ? aiReply : "", {
      stage: "7B.4",
      sourceServiceDecision: sourceCtx?.sourcePlan?.decision || "unknown",
      sourceRuntimeDecision: sourceCtx?.sourceRuntime?.decision || "unknown",
      sourceRuntimeNeedsSource: Boolean(sourceCtx?.sourceRuntime?.needsSource),
      sourceReason: sourceCtx?.reason || "unknown",
      sourceResultOk: Boolean(sourceCtx?.sourceResult?.ok),
      sourceResultKey: sourceCtx?.sourceResult?.sourceKey || null,
      longTermMemoryBridgePrepared: Boolean(longTermMemoryBridgeResult),
      longTermMemoryBridgeOk: Boolean(longTermMemoryBridgeResult?.ok),
      longTermMemoryBridgeReason: longTermMemoryBridgeResult?.reason || null,
      longTermMemoryInjected,
    });

    await touchAssistantChatMeta();
  } catch (e) {
    console.error("ERROR STAGE 7B.4 chat_messages assistant insert failed (fail-open):", e);
  }

  try {
    const meta = { senderIdStr, chatIdStr, messageId };

    const res = await memoryWritePair({
      userText: effective,
      assistantText: aiReply,
      transport: "telegram",
      metadata: meta,
      schemaVersion: 2,
    });

    if (!res || res.stored !== true) {
      try {
        console.error("MEMORY_PAIR_SAVE_NOT_STORED", {
          chatId: chatIdStr,
          globalUserId,
          senderId: senderIdStr,
          messageId,
          res: res || null,
        });
      } catch (_) {}
    } else {
      try {
        console.info("MEMORY_PAIR_SAVE_OK", {
          chatId: chatIdStr,
          globalUserId,
          senderId: senderIdStr,
          messageId,
        });
      } catch (_) {}
    }
  } catch (e) {
    console.error("ERROR saveChatPair error:", {
      chatId: chatIdStr,
      globalUserId,
      senderId: senderIdStr,
      messageId,
      err: e?.message ? String(e.message) : e,
    });
  }

  await finalizeChatReply({
    sanitizeNonMonarchReply,
    monarchNow,
    aiReply,
    bot,
    chatId,
    effective,
    senderIdStr,
    chatIdStr,
    messageId,
    globalUserId,
    sourceCtx,
    longTermMemoryBridgeResult,
    longTermMemoryInjected,
  });
}