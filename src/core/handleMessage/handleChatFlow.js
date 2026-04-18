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

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeLite(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function tokenizeLite(value) {
  const normalized = normalizeLite(value)
    .replace(/[.,!?;:()[\]{}<>\\|"'`~@#$%^&*+=]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

function tokenStartsWithAny(token, prefixes = []) {
  for (const prefix of prefixes) {
    if (token.startsWith(prefix)) return true;
  }
  return false;
}

function collectPrefixHitsLite(tokens, prefixes) {
  const hits = [];
  for (const token of tokens) {
    if (tokenStartsWithAny(token, prefixes)) {
      hits.push(token);
    }
  }
  return [...new Set(hits)];
}

const REPO_FOLLOWUP_INTENT_PREFIXES = Object.freeze([
  "объяс",
  "опис",
  "анализ",
  "проанализ",
  "перев",
  "русск",
  "кратк",
  "коротк",
  "прощ",
  "summary",
  "brief",
  "short",
  "simple",
  "explain",
  "analy",
  "translat",
]);

const REPO_FOLLOWUP_REFERENCE_TOKENS = Object.freeze([
  "это",
  "этот",
  "эту",
  "эти",
  "this",
  "it",
  "that",
  "теперь",
  "now",
]);

function looksLikeRepoFollowupRequest(text = "") {
  const normalized = normalizeLite(text);
  const tokens = tokenizeLite(text);

  if (!normalized) return false;

  const hasReferenceToken = tokens.some((token) => REPO_FOLLOWUP_REFERENCE_TOKENS.includes(token));
  const hasIntentStem = collectPrefixHitsLite(tokens, REPO_FOLLOWUP_INTENT_PREFIXES).length > 0;

  if (normalized.includes("на русском")) return true;
  if (normalized.includes("по-русски")) return true;
  if (normalized.includes("explain this")) return true;
  if (normalized.includes("translate this")) return true;

  return hasReferenceToken || hasIntentStem;
}

function buildProjectIntentRoutingText(trimmed, followupContext = null) {
  const base = safeText(trimmed);
  if (!followupContext?.isActive) return base;

  if (!looksLikeRepoFollowupRequest(base)) return base;

  const path = safeText(followupContext.targetPath);
  const entity = safeText(followupContext.targetEntity);
  const scope = safeText(followupContext.targetKind);

  const additions = [
    "repo sg",
    path,
    entity,
    scope,
  ].filter(Boolean);

  return `${base} ${additions.join(" ")}`.trim();
}

async function getLatestRepoFollowupContext(memory, {
  chatIdStr,
  globalUserId,
  chatType,
}) {
  try {
    const recent = await memory.recent({
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      chatType,
      limit: 20,
    });

    const rows = Array.isArray(recent) ? recent : [];

    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const item = rows[i] || {};
      const meta = item?.metadata || {};

      if (meta?.projectIntentRepoContextActive === true) {
        return {
          isActive: true,
          handlerKey: safeText(meta.projectIntentBridgeHandlerKey),
          planKey: safeText(meta.projectIntentPlanKey),
          targetKind: safeText(meta.projectIntentTargetKind),
          targetEntity: safeText(meta.projectIntentTargetEntity),
          targetPath: safeText(meta.projectIntentTargetPath),
          canonicalPillarPath: safeText(meta.projectIntentCanonicalPillarPath),
          commandArg: safeText(meta.projectIntentBridgeCommandArg),
          sourceText: safeText(meta.projectIntentSourceText),
        };
      }
    }

    return {
      isActive: false,
      handlerKey: "",
      planKey: "",
      targetKind: "",
      targetEntity: "",
      targetPath: "",
      canonicalPillarPath: "",
      commandArg: "",
      sourceText: "",
    };
  } catch (_) {
    return {
      isActive: false,
      handlerKey: "",
      planKey: "",
      targetKind: "",
      targetEntity: "",
      targetPath: "",
      canonicalPillarPath: "",
      commandArg: "",
      sourceText: "",
    };
  }
}

function buildInternalProjectFallbackReply({
  route,
  readPlan,
  repoBridge,
}) {
  if (readPlan?.needsClarification === true) {
    return safeText(readPlan?.clarificationQuestion) || "Что именно нужно открыть или объяснить?";
  }

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

    const repoFollowupContext = await getLatestRepoFollowupContext(memory, {
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
            projectIntentFollowupContextActive: projectIntentReadPlan.followupContextActive === true,

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
          project_intent_target_kind: projectIntentReadPlan.targetKind || "",
          project_intent_target_entity: projectIntentReadPlan.targetEntity || "",
          project_intent_target_path: projectIntentReadPlan.targetPath || "",
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