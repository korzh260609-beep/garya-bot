// src/bot/handlers/chat/postReplyFlow.js

import { runDecisionShadowHook } from "../../../decision/decisionShadowHook.js";
import { routeDecision } from "../../../decision/index.js";

export async function finalizeChatReply({
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
}) {
  let finalReply = aiReply;

  try {
    if (!monarchNow) finalReply = sanitizeNonMonarchReply(finalReply);
  } catch (e) {
    console.error("ERROR sanitizeNonMonarchReply error:", e);
  }

  try {
    await bot.sendMessage(chatId, finalReply);
  } catch (e) {
    console.error("ERROR Telegram send error:", e);
  }

  let decisionPreviewRoute = null;
  try {
    decisionPreviewRoute = await routeDecision({
      text: effective,
      command: null,
      transport: "telegram",
      userId: senderIdStr || null,
      chatId: chatIdStr || null,
      messageId: messageId ?? null,
      meta: {
        source: "chat_handler_preview_route",
      },
    });
  } catch (e) {
    console.error("ERROR decision preview route failed (fail-open):", e);
  }

  try {
    await runDecisionShadowHook(
      {
        goal: effective,
        text: effective,
        transport: "telegram",
        userId: senderIdStr || null,
        chatId: chatIdStr || null,
        messageId: messageId ?? null,
        globalUserId: globalUserId ?? null,
        meta: {
          source: "chat_handler_post_reply_shadow",
          previewKind: decisionPreviewRoute?.kind || null,
          previewWorkerType: decisionPreviewRoute?.workerType || null,
          previewReason: decisionPreviewRoute?.reason || null,
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
        },
      },
      {
        finalText: finalReply,
        route: {
          kind: decisionPreviewRoute?.kind || "core_chat",
          worker: decisionPreviewRoute?.workerType || "chat_handler",
          judgeRequired:
            typeof decisionPreviewRoute?.judgeRequired === "boolean"
              ? decisionPreviewRoute.judgeRequired
              : false,
          reason: decisionPreviewRoute?.reason || "chat_handler_post_reply_shadow",
        },
        warnings: [],
      }
    );
  } catch (e) {
    console.error("ERROR DecisionShadowHook failed (fail-open):", e);
  }

  return {
    finalReply,
    decisionPreviewRoute,
  };
}