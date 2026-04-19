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

import { resolveProjectIntentRoute } from "../projectIntent/projectIntentRoute.js";
import { requireProjectIntentAccess } from "../projectIntent/projectIntentGuard.js";
import { resolveProjectIntentReadPlan } from "../projectIntent/projectIntentReadPlan.js";
import { resolveProjectIntentRepoBridge } from "../projectIntent/projectIntentRepoBridge.js";
import { executeProjectIntentRepoBridge } from "../../bot/handlers/projectIntentRepoExecutor.js";
import {
  buildProjectIntentRoutingText,
  getLatestProjectIntentRepoContext,
  runProjectIntentConversationFlow,
} from "../projectIntent/projectIntentConversationService.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function buildInternalProjectFallbackReply({ readPlan }) {
  if (readPlan?.needsClarification === true) {
    return safeText(readPlan?.clarificationQuestion) || "Уточни, что именно нужно сделать с репозиторием.";
  }

  if (readPlan?.planKey === "repo_diff") {
    return "Уточни, что именно нужно сравнить.";
  }

  if (readPlan?.planKey === "stage_check") {
    return "Напиши, какой именно stage нужно проверить.";
  }

  return "Я понял, что это запрос к репозиторию проекта, но мне пока не хватает ясности: нужно найти, открыть, объяснить или сравнить?";
}

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

    const repoFollowupContext = await getLatestProjectIntentRepoContext(memory, {
      chatIdStr,
      globalUserId,
      chatType,
    });

    const projectIntentRoutingText = buildProjectIntentRoutingText(trimmed, repoFollowupContext);

    const projectIntentRoute = resolveProjectIntentRoute({
      text: projectIntentRoutingText,
      isMonarchUser: !!isMonarchUser,
      isPrivateChat: !!isPrivateChat,
    });

    const projectIntentAccess = await requireProjectIntentAccess({
      text: projectIntentRoutingText,
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
      followupContext: repoFollowupContext,
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

            projectIntentScope: projectIntentRoute.targetScope,
            projectIntentDomain: projectIntentRoute.targetDomain,
            projectIntentActionMode: projectIntentRoute.actionMode,
            projectIntentRouteKey: projectIntentRoute.routeKey,
            projectIntentPolicy: projectIntentRoute.policy,
            projectIntentConfidence: projectIntentRoute.confidence,

            projectIntentPlanKey: projectIntentReadPlan.planKey,
            projectIntentRecommendedCommand: projectIntentReadPlan.recommendedCommand,
            projectIntentPlanConfidence: projectIntentReadPlan.confidence,
            projectIntentPrimaryPathHint: projectIntentReadPlan.primaryPathHint,
            projectIntentRouteAllowsInternalRead: projectIntentReadPlan.routeAllowsInternalRead,
            projectIntentCanonicalPillarPath: projectIntentReadPlan.canonicalPillarPath || "",
            projectIntentTargetKind: projectIntentReadPlan.targetKind || "",
            projectIntentTargetEntity: projectIntentReadPlan.targetEntity || "",
            projectIntentTargetPath: projectIntentReadPlan.targetPath || "",
            projectIntentDisplayMode: projectIntentReadPlan.displayMode || "",
            projectIntentFollowupContextActive: projectIntentReadPlan.followupContextActive === true,
            projectIntentNeedsClarification: projectIntentReadPlan.needsClarification === true,

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

    // =========================================================================
    // HUMAN-FIRST repo conversation layer
    // =========================================================================
    const repoConversationResult = await runProjectIntentConversationFlow({
      trimmed,
      route: projectIntentRoute,
      readPlan: projectIntentReadPlan,
      followupContext: repoFollowupContext,
      replyAndLog,
      callAI: deps.callAI,
    });

    if (repoConversationResult?.handled) {
      return {
        ok: true,
        stage: "12A.0.repo_conversation",
        result: repoConversationResult.reason || "repo_conversation_handled",
      };
    }

    // =========================================================================
    // Thin bridge fallback for explicit/legacy internal repo actions
    // =========================================================================
    const projectIntentRepoExec = await executeProjectIntentRepoBridge(
      {
        ...(context || {}),
        bot: context?.bot || deps?.bot || null,
        chatId: chatIdNum,
        chatIdStr,
        chatType,
        transport,
        globalUserId,
        userRole,
        senderId,
        senderIdStr: String(senderId ?? ""),
        isMonarchUser: !!isMonarchUser,
        isPrivateChat: !!isPrivateChat,
        identityCtx: context?.identityCtx || null,
        reply: typeof replyAndLog === "function" ? replyAndLog : undefined,
      },
      projectIntentRepoBridge
    );

    if (projectIntentRepoExec?.executed) {
      try {
        await memory.write({
          chatId: chatIdStr,
          globalUserId: globalUserId || null,
          role: "assistant",
          content: [
            "[repo_context]",
            `handler=${safeText(projectIntentRepoBridge.handlerKey)}`,
            `path=${safeText(projectIntentReadPlan.targetPath || projectIntentReadPlan.canonicalPillarPath)}`,
            `entity=${safeText(projectIntentReadPlan.targetEntity)}`,
          ].join(" "),
          transport,
          metadata: {
            projectIntentRepoContextActive: true,
            projectIntentPlanKey: projectIntentReadPlan.planKey,
            projectIntentBridgeHandlerKey: projectIntentRepoBridge.handlerKey,
            projectIntentBridgeCommandArg: projectIntentRepoBridge.commandArg,
            projectIntentCanonicalPillarPath: projectIntentReadPlan.canonicalPillarPath || "",
            projectIntentTargetKind: projectIntentReadPlan.targetKind || "",
            projectIntentTargetEntity: projectIntentReadPlan.targetEntity || "",
            projectIntentTargetPath: projectIntentReadPlan.targetPath || "",
            projectIntentDisplayMode: projectIntentReadPlan.displayMode || "",
            projectIntentSourceText: safeText(trimmed),
            read_only: true,
          },
          schemaVersion: 2,
        });
      } catch (_) {}

      return {
        ok: true,
        stage: "12A.0.repo_bridge_execute",
        result: projectIntentRepoExec.reason || "repo_bridge_executed",
      };
    }

    if (projectIntentRoute?.targetScope === "sg_core_internal") {
      const internalReply = buildInternalProjectFallbackReply({
        readPlan: projectIntentReadPlan,
      });

      if (typeof replyAndLog === "function") {
        await replyAndLog(internalReply, {
          handler: "handleChatFlow",
          event: "internal_project_request_not_auto_executed",
          project_intent_scope: projectIntentRoute.targetScope,
          project_intent_domain: projectIntentRoute.targetDomain,
          project_intent_action_mode: projectIntentRoute.actionMode,
          project_intent_confidence: projectIntentRoute.confidence,
          project_intent_route_key: projectIntentRoute.routeKey,
          project_intent_policy: projectIntentRoute.policy,

          project_intent_plan_key: projectIntentReadPlan.planKey,
          project_intent_recommended_command: projectIntentReadPlan.recommendedCommand,
          project_intent_plan_confidence: projectIntentReadPlan.confidence,
          project_intent_primary_path_hint: projectIntentReadPlan.primaryPathHint || "",
          project_intent_canonical_pillar_path: projectIntentReadPlan.canonicalPillarPath || "",
          project_intent_target_kind: projectIntentReadPlan.targetKind || "",
          project_intent_target_entity: projectIntentReadPlan.targetEntity || "",
          project_intent_target_path: projectIntentReadPlan.targetPath || "",
          project_intent_display_mode: projectIntentReadPlan.displayMode || "",
          project_intent_followup_context_active: projectIntentReadPlan.followupContextActive === true,
          project_intent_needs_clarification: projectIntentReadPlan.needsClarification === true,

          project_intent_bridge_handler_key: projectIntentRepoBridge.handlerKey,
          project_intent_bridge_command: projectIntentRepoBridge.recommendedCommand,
          project_intent_bridge_command_arg: projectIntentRepoBridge.commandArg,
          project_intent_bridge_command_text: projectIntentRepoBridge.commandText,
          project_intent_bridge_can_auto_execute: projectIntentRepoBridge.canAutoExecute === true,
          project_intent_bridge_confidence: projectIntentRepoBridge.confidence,
          project_intent_bridge_basis: Array.isArray(projectIntentRepoBridge.basis)
            ? projectIntentRepoBridge.basis
            : [],
          read_only: true,
        });
      }

      return {
        ok: true,
        stage: "12A.0.internal_no_generic_fallback",
        result: "internal_project_request_not_auto_executed",
      };
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