// src/core/handleMessage.js
// STAGE 6.4 — handleMessage(context) — Core entrypoint for any transport.

import { isTransportTraceEnabled } from "../transport/transportConfig.js";
import { getMemoryService } from "./memoryServiceFactory.js";
import { envBool } from "./handleMessage/shared.js";
import { dedupeSeenHasFresh, dedupeRemember } from "./handleMessage/dedupeMemory.js";
import { normalizeContext } from "./handleMessage/normalizeContext.js";
import { resolveIdentityAndAccess } from "./handleMessage/resolveIdentityAndAccess.js";
import { parseCommandAccess } from "./handleMessage/commandParsing.js";
import { buildReplyAndLog } from "./handleMessage/buildReplyAndLog.js";
import { handleCommandFlow } from "./handleMessage/handleCommandFlow.js";
import { handleChatFlow } from "./handleMessage/handleChatFlow.js";
import { buildProjectLightEvidencePack } from "../projectExperience/ProjectLightEvidencePackBuilder.js";
import { ProjectEvidenceTriggerPolicy } from "../projectExperience/ProjectEvidenceTriggerPolicy.js";

function hasProjectEvidenceSeed(value = {}) {
  return Boolean(
    Array.isArray(value?.commits) ||
    value?.pillars ||
    Array.isArray(value?.memoryEvidences)
  );
}

function buildProjectMemoryEvidencePackIfAvailable(context = {}, deps = {}) {
  if (context?.projectMemoryEvidencePack || context?.projectEvidencePack) {
    return null;
  }

  const seed = context?.projectMemoryEvidenceSeed || deps?.projectMemoryEvidenceSeed || null;
  if (!seed || !hasProjectEvidenceSeed(seed)) {
    return null;
  }

  return buildProjectLightEvidencePack({
    commits: Array.isArray(seed?.commits) ? seed.commits : [],
    pillars: seed?.pillars || {},
    memoryEvidences: Array.isArray(seed?.memoryEvidences) ? seed.memoryEvidences : [],
    commitLimit: seed?.commitLimit ?? 5,
    projectKey: seed?.projectKey || "garya-bot",
    repository: seed?.repository || "korzh260609-beep/garya-bot",
    ref: seed?.ref || "main",
  });
}

export async function handleMessage(context = {}) {
  const normalized = normalizeContext(context);

  const {
    transport,
    chatId,
    senderId,
    text,
    messageId,
    raw,
    deps,
    hasReply,
    hasCallAI,
    isEnforced,
    globalUserId: initialGlobalUserId,
    chatType,
    isPrivateChat,
    bypassParsed,
    trimmed,
  } = normalized;

  let globalUserId = initialGlobalUserId;

  // TRIGGER POLICY
  const triggerPolicy = new ProjectEvidenceTriggerPolicy();
  const triggerDecision = triggerPolicy.shouldBuildEvidence({
    projectContextDecision: context?.projectContextDecision,
    hasExistingEvidencePack: Boolean(context?.projectMemoryEvidencePack),
    force: Boolean(context?.forceProjectEvidence),
  });

  // EVIDENCE BUILD
  let enrichedContext = context;
  try {
    if (triggerDecision.shouldBuild) {
      const evidencePack = buildProjectMemoryEvidencePackIfAvailable(context, deps);
      if (evidencePack) {
        enrichedContext = {
          ...context,
          projectMemoryEvidencePack: evidencePack,
        };
      }
    }
  } catch (e) {
    console.error("project memory evidence build failed (fail-open):", e);
  }

  if (isEnforced) {
    const dedupeKey = enrichedContext?.dedupeKey || null;
    if (!dedupeKey || !messageId) {
      return { ok: false, reason: "missing_dedupeKey", stage: "6.8" };
    }

    try {
      if (!bypassParsed.isBypass) {
        const now = Date.now();
        const key = String(dedupeKey);

        if (dedupeSeenHasFresh(key, now)) {
          return { ok: true, stage: "8D", result: "dup_drop" };
        }

        dedupeRemember(key, now);
      }
    } catch (e) {
      console.error("dedupe guard failed:", e);
    }
  }

  const identity = await resolveIdentityAndAccess({ transport, senderId, raw, globalUserId });
  globalUserId = identity.globalUserId;

  const { userRole, userPlan, user, isMonarchUser } = identity;

  const routing = parseCommandAccess({ trimmed, user, isMonarchUser });
  const { isCommand, cmdBase, rest, canProceed } = routing;

  if (!isEnforced) {
    return {
      ok: true,
      stage: "6.shadow",
      projectMemoryEvidenceTriggered: triggerDecision.shouldBuild,
    };
  }

  const chatIdNum = chatId ? Number(chatId) : null;
  const chatIdStr = chatId || "";

  if (!chatIdNum) return { ok: false, reason: "missing_chatId" };

  const replyAndLog = buildReplyAndLog({
    deps,
    context: enrichedContext,
    transport,
    chatIdStr,
    chatType,
    globalUserId,
    senderId,
    messageId,
  });

  if (isCommand && cmdBase) {
    return handleCommandFlow({
      context: enrichedContext,
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
      rest,
      cmdBase,
      user,
      userRole,
      userPlan,
      isMonarchUser,
      isPrivateChat,
      canProceed,
      replyAndLog,
    });
  }

  if (typeof deps?.handleChatMessage === "function") {
    return handleChatFlow({
      context: enrichedContext,
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
    });
  }

  return { ok: false, reason: "no_handler" };
}

export default handleMessage;