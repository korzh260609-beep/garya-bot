// src/core/handleMessage/handleChatFlow.js

import { isTransportTraceEnabled } from "../../transport/transportConfig.js";
import { getMemoryService } from "../memoryServiceFactory.js";
import { insertWebhookDedupeEvent } from "../../db/chatMessagesRepo.js";
import { touchChatMeta } from "../../db/chatMeta.js";
import { guardIncomingChatMessage } from "../../services/chatMemory/guardIncomingChatMessage.js";
import { redactText, sha256Text, buildRawMeta } from "../redaction.js";
import { buildInboundStorageText } from "./inboundBinary.js";
import { truncateForDb } from "./shared.js";
import { handleExplicitRemember } from "./handleExplicitRemember.js";
import { buildChatHandlerContext } from "./contextBuilders.js";
import { ConfirmationIntentClassifier, CONFIRMATION_INTENT } from "../../projectExperience/ConfirmationIntentClassifier.js";
import { getPendingProjectAction, consumePendingProjectAction, clearPendingProjectAction } from "../../projectExperience/PendingProjectActionStore.js";
import { createLivingSGBoundary } from "../living-sg/LivingSGBoundary.js";
import { handleHumanProjectIntent } from "../projectIntent/modes/human/projectIntentHumanEntry.js";
import { buildHumanProjectIntentContext } from "../projectIntent/modes/human/projectIntentHumanContext.js";
import { createHumanRepoStateAgentRunner } from "../projectIntent/modes/human/projectIntentHumanRepoStateAgentRunner.js";
import {
  handleLegacyProjectIntentFlow,
  LEGACY_PROJECT_INTENT_FLOW_PHASE,
} from "./legacyProjectIntentFlow.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function canUseHumanProjectRepoRead({ isMonarchUser, isPrivateChat } = {}) {
  return isMonarchUser === true && isPrivateChat === true;
}

async function loadHumanConversationContext({
  memory,
  chatIdStr,
  globalUserId,
  chatType,
  limit = 20,
} = {}) {
  try {
    if (!memory || typeof memory.recent !== "function") {
      return [];
    }

    return await memory.recent({
      chatId: chatIdStr,
      globalUserId,
      limit,
      chatType,
    });
  } catch (_) {
    return [];
  }
}

export function buildLivingSGShadowPlan({
  context,
  transport,
  chatIdStr,
  globalUserId,
  senderId,
  trimmed,
  userRole,
  isMonarchUser,
  isPrivateChat,
  repoFollowupContext,
  projectContextDecision,
  projectMemoryAutoCaptureMeta,
  livingSGBoundaryFactory = createLivingSGBoundary,
} = {}) {
  try {
    const shadowPlan = livingSGBoundaryFactory({
      text: trimmed,
      trimmed,
      transport,
      chatIdStr,
      globalUserId,
      senderId,
      userRole,
      isMonarchUser,
      isPrivateChat,
      hasActiveProjectSession: repoFollowupContext?.isActive === true,
      activeProjectContext: context?.activeProjectContext || null,
      coreMeaning: context?.coreMeaning || null,
      context: {
        activeProjectContext: context?.activeProjectContext || null,
        projectContextDecision: projectContextDecision || context?.projectContextDecision || null,
        projectMemoryAutoCaptureSummary: projectMemoryAutoCaptureMeta || null,
      },
    });

    if (isTransportTraceEnabled()) {
      console.log("LIVING_SG_SHADOW_PLAN", {
        source: shadowPlan?.source,
        ok: shadowPlan?.ok,
        dryRun: shadowPlan?.dryRun,
        connectedToRuntime: shadowPlan?.connectedToRuntime,
        intentKind: shadowPlan?.intentPlan?.intentKind,
        capabilityActionType: shadowPlan?.capabilityPlan?.actionType,
        gateStatus: shadowPlan?.gate?.status,
        responseKind: shadowPlan?.responsePlan?.responseKind,
        shouldCallAI: shadowPlan?.responsePlan?.shouldCallAI,
        shouldExecuteTool: shadowPlan?.responsePlan?.shouldExecuteTool,
        noStateChange: shadowPlan?.metadata?.noStateChange,
        noProjectIntentExecution: shadowPlan?.metadata?.noProjectIntentExecution,
      });
    }

    return shadowPlan;
  } catch (e) {
    try {
      console.error("Living SG shadow plan failed (fail-open):", e);
    } catch (_) {}
    return null;
  }
}

function buildPendingActionClarification(pendingAction = {}) {
  const impact = pendingAction?.impact?.impact || pendingAction?.impact || {};
  const risks = Array.isArray(impact?.risks) ? impact.risks.slice(0, 5) : [];
  const checks = Array.isArray(impact?.requiredChecks) ? impact.requiredChecks.slice(0, 5) : [];

  return [
    "Уточнение по ожидающему действию:",
    `Тип: ${safeText(pendingAction?.actionType) || "unknown"}`,
    `Риск: ${safeText(impact?.riskLevel) || "unknown"}`,
    risks.length ? "" : null,
    risks.length ? "Основные риски:" : null,
    ...risks.map((item) => `- ${item}`),
    checks.length ? "" : null,
    checks.length ? "Что лучше проверить:" : null,
    ...checks.map((item) => `- ${item}`),
    "",
    "Можно подтвердить, отменить или попросить ещё уточнить.",
  ]
    .filter(Boolean)
    .join("\n");
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
    const confirmationIntentClassifier = new ConfirmationIntentClassifier();

    const pendingProjectAction = getPendingProjectAction({
      transport,
      chatId: chatIdStr,
      globalUserId,
    });

    if (pendingProjectAction) {
      const confirmationIntent = confirmationIntentClassifier.classify({
        text: trimmed,
        pendingAction: pendingProjectAction,
      });

      if (confirmationIntent.intent === CONFIRMATION_INTENT.CANCEL) {
        clearPendingProjectAction({ transport, chatId: chatIdStr, globalUserId });

        if (typeof replyAndLog === "function") {
          await replyAndLog("Ок. Действие отменено, ничего не выполняю.", {
            handler: "handleChatFlow",
            event: "pending_project_action_cancelled",
            action_type: pendingProjectAction.actionType,
            confirmation_reason: confirmationIntent.reason,
            transport_agnostic: true,
          });
        }

        return {
          ok: true,
          stage: "C.6D.pending_project_action",
          result: "cancelled",
        };
      }

      if (confirmationIntent.intent === CONFIRMATION_INTENT.CLARIFY) {
        if (typeof replyAndLog === "function") {
          await replyAndLog(buildPendingActionClarification(pendingProjectAction), {
            handler: "handleChatFlow",
            event: "pending_project_action_clarify",
            action_type: pendingProjectAction.actionType,
            confirmation_reason: confirmationIntent.reason,
            transport_agnostic: true,
          });
        }

        return {
          ok: true,
          stage: "C.6D.pending_project_action",
          result: "clarified",
        };
      }

      if (confirmationIntent.intent === CONFIRMATION_INTENT.CONFIRM) {
        const consumed = consumePendingProjectAction({
          transport,
          chatId: chatIdStr,
          globalUserId,
        });

        if (typeof replyAndLog === "function") {
          await replyAndLog(
            [
              "Подтверждение принято.",
              "На этом этапе действие НЕ выполняется автоматически: executor ещё не подключён.",
              `Тип ожидающего действия: ${safeText(consumed?.actionType) || "unknown"}`,
              "Следующий безопасный шаг — подключить executor для конкретного actionType.",
            ].join("\n"),
            {
              handler: "handleChatFlow",
              event: "pending_project_action_confirmed_no_executor",
              action_type: consumed?.actionType,
              confirmation_reason: confirmationIntent.reason,
              transport_agnostic: true,
            }
          );
        }

        return {
          ok: true,
          stage: "C.6D.pending_project_action",
          result: "confirmed_no_executor",
        };
      }
    }

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
        transport,
        metadata: meta,
        schemaVersion: opts?.schemaVersion ?? 2,
      });
    };

    const legacyProjectIntentPrepare = await handleLegacyProjectIntentFlow({
      phase: LEGACY_PROJECT_INTENT_FLOW_PHASE.PREPARE,
      memory,
      context,
      deps,
      transport,
      chatIdStr,
      chatType,
      globalUserId,
      senderId,
      messageId,
      trimmed,
      userRole,
      isMonarchUser,
      isPrivateChat,
      replyAndLog,
    });

    if (legacyProjectIntentPrepare?.handled) {
      return legacyProjectIntentPrepare.response;
    }

    const legacyProjectIntentPrepared = legacyProjectIntentPrepare?.prepared || null;
    const repoFollowupContext = legacyProjectIntentPrepare?.projectIntentRepoContext || null;
    const pendingChoiceContext = legacyProjectIntentPrepared?.pendingChoiceContext || null;
    const projectIntentRoutingText = legacyProjectIntentPrepared?.projectIntentRoutingText || trimmed;
    const projectIntentRoute = legacyProjectIntentPrepared?.projectIntentRoute || {};
    const projectContextDecision = legacyProjectIntentPrepare?.projectContextDecision || null;
    const projectMemoryAutoCaptureMeta = legacyProjectIntentPrepare?.projectMemoryAutoCaptureSummary || null;

    const livingSGPlan = buildLivingSGShadowPlan({
      context,
      transport,
      chatIdStr,
      globalUserId,
      senderId,
      trimmed,
      userRole,
      isMonarchUser,
      isPrivateChat,
      repoFollowupContext,
      projectContextDecision,
      projectMemoryAutoCaptureMeta,
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

            projectIntentRouteKey: projectIntentRoute.routeKey,
            projectIntentPolicy: projectIntentRoute.policy,
            projectIntentConfidence: projectIntentRoute.confidence,
            projectIntentScope: projectIntentRoute.targetScope,
            projectIntentDomain: projectIntentRoute.targetDomain,
            projectIntentActionMode: projectIntentRoute.actionMode,

            projectIntentFollowupContextActive: repoFollowupContext?.isActive === true,
            projectIntentPendingChoiceActive: pendingChoiceContext?.isActive === true,
            projectIntentRoutingText: projectIntentRoutingText,

            projectContextNeeded: projectContextDecision?.depth !== "none",
            projectContextDepth: projectContextDecision?.depth,
            projectContextTrigger: projectContextDecision?.trigger,
            projectContextStageKey: projectContextDecision?.stageKey,
            projectContextReasons: projectContextDecision?.reasons,

            ...projectMemoryAutoCaptureMeta,
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

          return { ok: true, stage: "7B.7", result: "dup_chat_drop", projectMemoryAutoCaptureSummary: projectMemoryAutoCaptureMeta };
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

    const legacyProjectIntentContinue = await handleLegacyProjectIntentFlow({
      phase: LEGACY_PROJECT_INTENT_FLOW_PHASE.CONTINUE,
      memory,
      deps,
      transport,
      chatIdStr,
      globalUserId,
      trimmed,
      replyAndLog,
      prepared: legacyProjectIntentPrepared,
    });

    if (legacyProjectIntentContinue?.handled) {
      return legacyProjectIntentContinue.response;
    }

    if (canUseHumanProjectRepoRead({ isMonarchUser, isPrivateChat })) {
      const conversationHistory = await loadHumanConversationContext({
        memory,
        chatIdStr,
        globalUserId,
        chatType,
        limit: deps?.MAX_HISTORY_MESSAGES || 20,
      });

      const humanProjectIntentResult = await handleHumanProjectIntent({
        text: trimmed,
        isMonarchUser,
        isPrivateChat,
        context: buildHumanProjectIntentContext({
          allowHumanRepoStateAgentRun: true,
          repoStateAgentRunner: createHumanRepoStateAgentRunner({
            defaultOptions: {
              fastReadOnly: true,
            },
          }),
          metadata: {
            source: "handleChatFlow",
            transport,
            chatType,
            chatIdStr,
            globalUserId,
            capability: "repo.read",
            stateChanging: false,
            projectContextDepth: projectContextDecision?.depth || null,
            projectContextDecision,
            projectIntentRoute,
            projectIntentRoutingText,
            repoFollowupContext,
            activeProjectContext: context?.activeProjectContext || null,
            coreMeaning: context?.coreMeaning || null,
            conversationHistory,
          },
        }),
      });

      if (humanProjectIntentResult?.handled === true && humanProjectIntentResult?.response?.text) {
        await replyAndLog(humanProjectIntentResult.response.text, {
          handler: "handleChatFlow",
          event: "human_project_intent_repo_read_handled",
          transport_agnostic: true,
          capability: humanProjectIntentResult?.capability?.capability || "",
          read_only: true,
          state_changing: false,
          project_context_depth: projectContextDecision?.depth || null,
          conversation_history_count: Array.isArray(conversationHistory) ? conversationHistory.length : 0,
        });

        return {
          ok: true,
          stage: "human.projectIntent.repoRead",
          result: "handled",
          projectContextDecision,
          projectMemoryAutoCaptureSummary: projectMemoryAutoCaptureMeta,
        };
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
      projectIntentRepoContext: repoFollowupContext,
      livingSGPlan,
    });

    await deps.handleChatMessage(chatHandlerCtx);

    return {
      ok: true,
      stage: "6.logic.2",
      result: "chat_handled",
      projectContextDecision,
      projectMemoryAutoCaptureSummary: projectMemoryAutoCaptureMeta,
    };
  } catch (e) {
    console.error("handleMessage(handleChatMessage) failed:", e);
    return { ok: false, reason: "chat_error" };
  }
}
