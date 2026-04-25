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
import { ProjectContextEngine } from "../../projectExperience/ProjectContextEngine.js";
import { ProjectMemoryAutoCapture } from "../../projectExperience/ProjectMemoryAutoCapture.js";
import { ConfirmationIntentClassifier, CONFIRMATION_INTENT } from "../../projectExperience/ConfirmationIntentClassifier.js";
import { getPendingProjectAction, consumePendingProjectAction, clearPendingProjectAction } from "../../projectExperience/PendingProjectActionStore.js";

import { resolveProjectIntentRoute } from "../projectIntent/projectIntentRoute.js";
import { requireProjectIntentAccess } from "../projectIntent/projectIntentGuard.js";
import {
  buildProjectIntentRoutingText,
  getLatestProjectIntentRepoContext,
  getLatestProjectIntentPendingChoice,
  runProjectIntentConversationFlow,
} from "../projectIntent/projectIntentConversationService.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildInternalProjectFallbackReply() {
  return "Я понял, что это запрос к репозиторию проекта, но пока не могу уверенно определить, что именно нужно: найти, открыть, показать дерево или объяснить.";
}

function buildAutoCaptureSourceRef({ transport, chatIdStr, messageId } = {}) {
  return `${safeText(transport) || "unknown"}:${safeText(chatIdStr) || "unknown"}:${messageId ?? "no-message-id"}`;
}

function resolveProjectMemoryEvidenceInputs({ context = {}, deps = {} } = {}) {
  const fromContext = context?.projectMemoryEvidencePack || context?.projectEvidencePack || null;
  const fromDeps = deps?.projectMemoryEvidencePack || deps?.projectEvidencePack || null;
  const evidencePack = fromContext || fromDeps || null;

  return {
    repoEvidences: ensureArray(evidencePack?.repoEvidences),
    pillarContext: evidencePack?.pillarContext || null,
    memoryEvidences: ensureArray(evidencePack?.memoryEvidences),
    evidenceSummary: evidencePack?.summary || null,
  };
}

function buildProjectMemoryAutoCaptureMetadata(result = null, evidenceInputs = null) {
  const evidenceSummary = evidenceInputs?.evidenceSummary || null;

  if (!result || typeof result !== "object") {
    return {
      projectMemoryAutoCaptureShouldCapture: false,
      projectMemoryAutoCaptureReasons: [],
      projectMemoryAutoCapturePolicySummary: null,
      projectMemoryAutoCaptureVerificationStatus: null,
      projectMemoryAutoCaptureDryRun: true,
      projectMemoryAutoCaptureEvidenceSummary: evidenceSummary,
    };
  }

  return {
    projectMemoryAutoCaptureShouldCapture: result?.shouldCapture === true,
    projectMemoryAutoCaptureReasons: Array.isArray(result?.reasons) ? result.reasons : [],
    projectMemoryAutoCapturePolicySummary: result?.policySummary || null,
    projectMemoryAutoCaptureVerificationStatus: safeText(result?.verification?.status) || null,
    projectMemoryAutoCaptureDryRun: result?.dryRun !== false,
    projectMemoryAutoCaptureEvidenceSummary: evidenceSummary,
  };
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
    const projectContextEngine = new ProjectContextEngine();
    const projectMemoryAutoCapture = new ProjectMemoryAutoCapture();
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

    const repoFollowupContext = await getLatestProjectIntentRepoContext(memory, {
      chatIdStr,
      globalUserId,
      chatType,
    });

    const pendingChoiceContext = await getLatestProjectIntentPendingChoice(memory, {
      chatIdStr,
      globalUserId,
      chatType,
    });

    const projectIntentRoutingText = buildProjectIntentRoutingText(
      trimmed,
      repoFollowupContext,
      pendingChoiceContext
    );

    const projectContextDecision = context?.projectContextDecision || projectContextEngine.classifyProjectContextNeed({
      text: projectIntentRoutingText,
      hasActiveProjectSession: repoFollowupContext?.isActive === true,
    });

    const projectMemoryEvidenceInputs = resolveProjectMemoryEvidenceInputs({ context, deps });
    let projectMemoryAutoCaptureResult = null;
    let projectMemoryAutoCaptureMeta = buildProjectMemoryAutoCaptureMetadata(null, projectMemoryEvidenceInputs);

    try {
      projectMemoryAutoCaptureResult = projectMemoryAutoCapture.prepareFromUserMessage({
        text: projectIntentRoutingText,
        projectKey: "garya-bot",
        sourceRef: buildAutoCaptureSourceRef({ transport, chatIdStr, messageId }),
        isMonarchUser: !!isMonarchUser,
        projectContextDecision,
        repoEvidences: projectMemoryEvidenceInputs.repoEvidences,
        pillarContext: projectMemoryEvidenceInputs.pillarContext,
        memoryEvidences: projectMemoryEvidenceInputs.memoryEvidences,
      });

      projectMemoryAutoCaptureMeta = buildProjectMemoryAutoCaptureMetadata(
        projectMemoryAutoCaptureResult,
        projectMemoryEvidenceInputs
      );
    } catch (e) {
      console.error("ERROR project memory auto-capture dry-run failed (fail-open):", e);
      projectMemoryAutoCaptureMeta = {
        ...buildProjectMemoryAutoCaptureMetadata(null, projectMemoryEvidenceInputs),
        projectMemoryAutoCaptureError: true,
      };
    }

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
      globalUserId,
      chatId: chatIdStr,
      transport,
    });

    if (!projectIntentAccess.allowed) {
      return {
        ok: true,
        stage: "12A.0.intent_guard",
        result: "project_intent_blocked",
        projectContextDecision,
        projectMemoryAutoCaptureSummary: projectMemoryAutoCaptureMeta,
      };
    }

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

    const repoConversationResult = await runProjectIntentConversationFlow({
      trimmed,
      route: projectIntentRoute,
      followupContext: repoFollowupContext,
      pendingChoiceContext,
      replyAndLog,
      callAI: deps.callAI,
    });

    if (repoConversationResult?.handled) {
      if (repoConversationResult?.contextMeta) {
        try {
          await memory.write({
            chatId: chatIdStr,
            globalUserId: globalUserId || null,
            role: "assistant",
            content: [
              "[repo_context]",
              `path=${safeText(repoConversationResult.contextMeta.projectIntentTargetPath)}`,
              `entity=${safeText(repoConversationResult.contextMeta.projectIntentTargetEntity)}`,
              `mode=${safeText(repoConversationResult.contextMeta.projectIntentDisplayMode)}`,
            ].join(" "),
            transport,
            metadata: {
              ...repoConversationResult.contextMeta,
              projectContextDecision,
              projectMemoryAutoCaptureSummary: projectMemoryAutoCaptureMeta,
              read_only: true,
            },
            schemaVersion: 2,
          });
        } catch (_) {}
      }

      return {
        ok: true,
        stage: "12A.0.repo_conversation",
        result: repoConversationResult.reason || "repo_conversation_handled",
        projectContextDecision,
        projectMemoryAutoCaptureSummary: projectMemoryAutoCaptureMeta,
      };
    }

    if (projectIntentRoute?.targetScope === "sg_core_internal") {
      const internalReply = buildInternalProjectFallbackReply();

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
          project_context_depth: projectContextDecision?.depth,
          project_context_trigger: projectContextDecision?.trigger,
          project_context_stage_key: projectContextDecision?.stageKey,
          project_memory_auto_capture_summary: projectMemoryAutoCaptureMeta,
          read_only: true,
        });
      }

      return {
        ok: true,
        stage: "12A.0.internal_no_generic_fallback",
        result: "internal_project_request_not_auto_executed",
        projectContextDecision,
        projectMemoryAutoCaptureSummary: projectMemoryAutoCaptureMeta,
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
      projectIntentRepoContext: repoFollowupContext,
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
