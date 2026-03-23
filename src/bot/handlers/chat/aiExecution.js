// src/bot/handlers/chat/aiExecution.js

import BehaviorEventsService from "../../../logging/BehaviorEventsService.js";

export function resolveAiParams(answerMode) {
  let maxTokens = 350;
  let temperature = 0.6;

  if (answerMode === "short") {
    maxTokens = 150;
    temperature = 0.3;
  } else if (answerMode === "long") {
    maxTokens = 900;
    temperature = 0.8;
  }

  return {
    maxTokens,
    temperature,
  };
}

export async function executeChatAI({
  callAI,
  filtered,
  classification,
  maxTokens,
  temperature,
  monarchNow,
  logInteraction,
  aiMetaBase,
  globalUserId,
  chatIdStr,
}) {
  try {
    console.info("AI_CALL_START", aiMetaBase);
  } catch (_) {}

  try {
    await logInteraction(chatIdStr, { ...classification, event: "AI_CALL_START", ...aiMetaBase });
  } catch (e) {
    console.error("ERROR logInteraction (AI_CALL_START) error:", e);
  }

  const t0 = Date.now();

  let aiReply = "";
  try {
    aiReply = await callAI(filtered, classification.aiCostLevel, {
      max_completion_tokens: maxTokens,
      temperature,
    });
  } catch (e) {
    console.error("ERROR AI error:", e);

    const msgText = e?.message ? String(e.message) : "unknown";
    aiReply = monarchNow ? `ERROR: Ошибка вызова ИИ: ${msgText}` : "ERROR: Ошибка вызова ИИ.";
  }

  const dtMs = Date.now() - t0;
  const aiMetaEnd = {
    ...aiMetaBase,
    dtMs,
    replyChars: typeof aiReply === "string" ? aiReply.length : 0,
    ok: !(typeof aiReply === "string" && aiReply.startsWith("ERROR: Ошибка вызова ИИ")),
  };

  try {
    const looksLikeClarification = typeof aiReply === "string" && aiReply.trim().endsWith("?");
    if (looksLikeClarification) {
      const be = new BehaviorEventsService();
      await be.logEvent({
        globalUserId: globalUserId ?? null,
        chatId: chatIdStr,
        eventType: "clarification_asked",
        metadata: { replyChars: aiReply.length },
        transport: "telegram",
        schemaVersion: 1,
      });
    }
  } catch (clarErr) {
    console.error("behavior_events clarification_asked log failed:", clarErr);
  }

  try {
    console.info("AI_CALL_END", aiMetaEnd);
  } catch (_) {}

  try {
    await logInteraction(chatIdStr, { ...classification, event: "AI_CALL_END", ...aiMetaEnd });
  } catch (e) {
    console.error("ERROR logInteraction (AI_CALL_END) error:", e);
  }

  return {
    aiReply,
    aiMetaEnd,
  };
}