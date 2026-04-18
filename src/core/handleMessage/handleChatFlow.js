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
import { executeProjectIntentRepoBridge } from "../../bot/handlers/projectIntentRepoExecutor.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function buildInternalProjectFallbackReply({
  route,
  readPlan,
  repoBridge,
}) {
  const routeKey = safeText(route?.routeKey) || "unknown";
  const planKey = safeText(readPlan?.planKey) || "unknown";
  const recommendedCommand = safeText(repoBridge?.recommendedCommand);
  const commandText = safeText(repoBridge?.commandText);
  const commandArg = safeText(repoBridge?.commandArg);
  const primaryPathHint = safeText(readPlan?.primaryPathHint);
  const canonicalPillarPath = safeText(readPlan?.canonicalPillarPath);
  const confidence = safeText(repoBridge?.confidence || readPlan?.confidence || route?.confidence) || "low";

  const lines = [
    "INTERNAL PROJECT REQUEST DETECTED",
    "",
    "Я распознал внутренний запрос к проекту SG и НЕ передал его в обычный AI-чат, чтобы не дать ложный ответ.",
    "",
    `route: ${routeKey}`,
    `plan: ${planKey}`,
    `confidence: ${confidence}`,
  ];

  if (recommendedCommand) {
    lines.push(`recommended_command: ${recommendedCommand}`);
  }

  if (commandText) {
    lines.push(`command_text: ${commandText}`);
  }

  if (commandArg) {
    lines.push(`command_arg: ${commandArg}`);
  }

  if (primaryPathHint) {
    lines.push(`path_hint: ${primaryPathHint}`);
  }

  if (canonicalPillarPath) {
    lines.push(`canonical_pillar: ${canonicalPillarPath}`);
  }

  lines.push("");
  lines.push("Автовыполнение сейчас не произошло.");

  const hints = [];

  if (planKey === "workflow_check") {
    hints.push("- Для workflow_check нужен конкретный step.");
    hints.push("- Либо укажи step явно, либо попроси открыть сам документ workflow.");
    hints.push("- Примеры: /workflow_check 12A.0  |  открой workflow md");
  } else if (planKey === "stage_check") {
    hints.push("- Для stage_check лучше указывать конкретную стадию или профиль проверки.");
  } else if (planKey === "repo_file" && !commandArg) {
    hints.push("- Нужен конкретный path к файлу.");
  } else if (planKey === "repo_analyze" && !commandArg) {
    hints.push("- Для repo_analyze нужен path к файлу или каноническому документу.");
  } else if (planKey === "repo_search" && !commandArg) {
    hints.push("- Нужен поисковый аргумент: path, имя файла, ключевой термин или pillars/.");
  } else if (planKey === "repo_diff") {
    hints.push("- Для repo_diff нужна явно указанная цель сравнения.");
  }

  if (hints.length === 0) {
    hints.push("- Уточни step / path / документ / цель проверки.");
  }

  lines.push("Что уточнить:");
  for (const hint of hints) {
    lines.push(hint);
  }

  return lines.join("\n").slice(0, 3900);
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

            // STAGE 12A.0 read-plan snapshot
            projectIntentPlanKey: projectIntentReadPlan.planKey,
            projectIntentRecommendedCommand: projectIntentReadPlan.recommendedCommand,
            projectIntentPlanConfidence: projectIntentReadPlan.confidence,
            projectIntentPrimaryPathHint: projectIntentReadPlan.primaryPathHint,
            projectIntentRouteAllowsInternalRead: projectIntentReadPlan.routeAllowsInternalRead,
            projectIntentCanonicalPillarPath: projectIntentReadPlan.canonicalPillarPath || "",

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

    // =========================================================================
    // STAGE 12A.0 — SAFE AUTO-EXECUTION FOR INTERNAL SG READ-ONLY REPO REQUESTS
    // - only after route/guard/read-plan/bridge
    // - only for bridge.canAutoExecute === true
    // - only existing read-only handlers
    // IMPORTANT:
    // - pass senderIdStr / identityCtx / bot / chatId explicitly
    // - do not rely on loose context merge only
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
      return {
        ok: true,
        stage: "12A.0.repo_bridge_execute",
        result: projectIntentRepoExec.reason || "repo_bridge_executed",
      };
    }

    // =========================================================================
    // STAGE 12A.0 — HARD STOP FOR INTERNAL SG PROJECT REQUESTS
    // IMPORTANT:
    // - if request is recognized as SG internal and allowed,
    //   but repo bridge did not execute, DO NOT fall back into generic AI chat
    // - otherwise AI may hallucinate that there is no repo access
    // =========================================================================
    if (projectIntentRoute?.targetScope === "sg_core_internal") {
      const internalReply = buildInternalProjectFallbackReply({
        route: projectIntentRoute,
        readPlan: projectIntentReadPlan,
        repoBridge: projectIntentRepoBridge,
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