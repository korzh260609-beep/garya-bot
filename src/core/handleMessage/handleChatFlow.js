// src/core/handleMessage/handleChatFlow.js

import { getMemoryService } from "../memoryServiceFactory.js";
import { insertWebhookDedupeEvent } from "../../db/chatMessagesRepo.js";
import { touchChatMeta } from "../../db/chatMeta.js";
import { guardIncomingChatMessage } from "../../services/chatMemory/guardIncomingChatMessage.js";
import { redactText, sha256Text, buildRawMeta } from "../redaction.js";
import { buildInboundStorageText } from "./inboundBinary.js";
import { truncateForDb } from "./shared.js";
import { handleExplicitRemember } from "./handleExplicitRemember.js";
import { buildChatHandlerContext } from "./contextBuilders.js";

// ✅ STAGE 12A.0 — future intent-level routing + guard for internal SG project requests
import { resolveProjectIntentRoute } from "../projectIntent/projectIntentRoute.js";
import { requireProjectIntentAccess } from "../projectIntent/projectIntentGuard.js";
import { resolveProjectIntentReadPlan } from "../projectIntent/projectIntentReadPlan.js";
import { resolveProjectIntentRepoBridge } from "../projectIntent/projectIntentRepoBridge.js";

export async function handleChatFlow({
  context,
  deps,
  transport,
  chatIdStr,
  chatIdNum,
  chatType,
  globalUserId,
  senderId,
  messageId,
  raw,
  trimmed,
  userRole,
  isMonarchUser,
  isPrivateChat,
  replyAndLog,
}) {
  try {
    const memory = getMemoryService();

    const saveMessageToMemory = async (chatIdStr2, role, content, opts = {}) => {
      return memory.write({
        chatId: chatIdStr2,
        globalUserId: opts?.globalUserId ?? globalUserId ?? null,
        role,
        content: String(content ?? ""),
        transport: opts?.transport ?? transport,
        metadata: opts?.metadata ?? {},
        schemaVersion: opts?.schemaVersion ?? 2,
      });
    };

    const saveChatPair = async (chatIdStr2, _userText, assistantText, opts = {}) => {
      const meta = opts?.metadata ?? {};
      return memory.write({
        chatId: chatIdStr2,
        globalUserId: opts?.globalUserId ?? globalUserId ?? null,
        role: "assistant",
        content: String(assistantText ?? ""),
        transport: opts?.transport ?? transport,
        metadata: meta,
        schemaVersion: opts?.schemaVersion ?? 2,
      });
    };

    // =========================================================================
    // STAGE 12A.0 — FREE-TEXT INTERNAL PROJECT INTENT ROUTE + GUARD + READ PLAN
    // - route decision is resolved once
    // - guard enforces SG core internal access policy
    // - read plan prepares future bridge to repo read/search/analyze
    // - repo bridge normalizes future handler/command target
    // =========================================================================
    const projectIntentRoute = resolveProjectIntentRoute({
      text: trimmed,
      isMonarchUser: !!isMonarchUser,
      isPrivateChat: !!isPrivateChat,
    });

    const projectIntentAccess = await requireProjectIntentAccess({
      text: trimmed,
      isMonarchUser: !!isMonarchUser,
      isPrivateChat: !!isPrivateChat,
      replyAndLog,
      resolvedRoute: projectIntentRoute,
    });

    if (!projectIntentAccess.allowed) {
      return {
        ok: true,
        stage: "12A.0.intent_guard",
        result: "project_intent_blocked",
      };
    }

    const projectIntentReadPlan = resolveProjectIntentReadPlan({
      text: trimmed,
      route: projectIntentRoute,
    });

    const projectIntentRepoBridge = resolveProjectIntentRepoBridge({
      route: projectIntentRoute,
      readPlan: projectIntentReadPlan,
    });

    const explicitRememberResult = await handleExplicitRemember({
      trimmed,
      chatIdStr,
      globalUserId,
      transport,
      senderId,
      messageId,
      userRole,
      replyAndLog,
    });

    if (explicitRememberResult?.handled) {
      return explicitRememberResult.response;
    }

    if (
      transport === "telegram" &&
      messageId !== null &&
      Number.isFinite(Number(messageId))
    ) {
      try {
        const inboundStorage = buildInboundStorageText(trimmed, raw);
        const red = redactText(inboundStorage.content);
        const { text: content, truncated } = truncateForDb(red);
        const textHash = sha256Text(red);

        const ins = await guardIncomingChatMessage({
          transport,
          chatId: chatIdStr,
          chatType,
          globalUserId: globalUserId || null,
          senderId: senderId || null,
          messageId: Number(messageId),
          textHash,
          content,
          truncated,
          metadata: {
            stage: "7B.7.core.in",
            senderId,
            chatId: chatIdStr,
            messageId: Number(messageId),
            hasBinaryAttachment: inboundStorage.hasBinaryAttachment,
            attachmentKinds: inboundStorage.attachmentKinds,

            // STAGE 12A.0 route snapshot (diagnostic-safe, no side effects)
            projectIntentScope: projectIntentRoute.targetScope,
            projectIntentDomain: projectIntentRoute.targetDomain,
            projectIntentActionMode: projectIntentRoute.actionMode,
            projectIntentRouteKey: projectIntentRoute.routeKey,
            projectIntentPolicy: projectIntentRoute.policy,
            projectIntentConfidence: projectIntentRoute.confidence,

            // STAGE 12A.0 read-plan snapshot (future free-text repo bridge)
            projectIntentPlanKey: projectIntentReadPlan.planKey,
            projectIntentRecommendedCommand: projectIntentReadPlan.recommendedCommand,
            projectIntentPlanConfidence: projectIntentReadPlan.confidence,
            projectIntentPrimaryPathHint: projectIntentReadPlan.primaryPathHint,
            projectIntentRouteAllowsInternalRead: projectIntentReadPlan.routeAllowsInternalRead,

            // STAGE 12A.0 repo-bridge snapshot
            projectIntentBridgeHandlerKey: projectIntentRepoBridge.handlerKey,
            projectIntentBridgeCommand: projectIntentRepoBridge.recommendedCommand,
            projectIntentBridgeCommandArg: projectIntentRepoBridge.commandArg,
            projectIntentBridgeCommandText: projectIntentRepoBridge.commandText,
            projectIntentBridgeCanAutoExecute: projectIntentRepoBridge.canAutoExecute,
            projectIntentBridgeConfidence: projectIntentRepoBridge.confidence,
          },
          raw: buildRawMeta(raw || {}),
          schemaVersion: 1,
        });

        if (ins?.duplicate === true) {
          try {
            console.info("WEBHOOK_DEDUPE_HIT", {
              transport,
              chatId: chatIdStr,
              messageId: Number(messageId),
              reason: "chat_messages_conflict",
              stage: "7B.7.core",
            });
          } catch (_) {}

          try {
            await insertWebhookDedupeEvent({
              transport,
              chatId: chatIdStr,
              messageId: Number(messageId),
              globalUserId: globalUserId || null,
              reason: "retry_duplicate",
              metadata: { handler: "core.handleMessage", stage: "7B.7.core" },
            });
          } catch (e) {
            console.error("ERROR webhook_dedupe_events insert failed:", e);
          }

          try {
            await touchChatMeta({
              transport,
              chatId: String(chatIdStr),
              chatType,
              title: raw?.chat?.title || null,
              role: "user",
            });
          } catch (_) {}

          return { ok: true, stage: "7B.7", result: "dup_chat_drop" };
        }

        try {
          await touchChatMeta({
            transport,
            chatId: String(chatIdStr),
            chatType,
            title: raw?.chat?.title || null,
            role: "user",
          });
        } catch (_) {}
      } catch (e) {
        console.error("ERROR STAGE 7B.7 core chat insert-first failed (fail-open):", e);
      }
    }

    const chatHandlerCtx = buildChatHandlerContext({
      context,
      deps,
      chatIdNum,
      chatIdStr,
      senderId,
      globalUserId,
      userRole,
      trimmed,
      saveMessageToMemory,
      saveChatPair,
    });

    await deps.handleChatMessage(chatHandlerCtx);

    return { ok: true, stage: "6.logic.2", result: "chat_handled" };
  } catch (e) {
    console.error("handleMessage(handleChatMessage) failed:", e);
    return { ok: false, reason: "chat_error" };
  }
}