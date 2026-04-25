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
import { ProjectContextEngine } from "../projectExperience/ProjectContextEngine.js";
import { ProjectEvidenceTriggerPolicy } from "../projectExperience/ProjectEvidenceTriggerPolicy.js";
import { buildProjectLightEvidencePack } from "../projectExperience/ProjectLightEvidencePackBuilder.js";
import { understandProjectMeaning } from "../projectExperience/ProjectMeaningLayer.js";
import { getCachedSeed, setCachedSeed } from "../projectExperience/ProjectEvidenceSeedCache.js";
import { understandMeaning } from "./meaning/MeaningEngine.js";

function hasProjectEvidenceSeed(value = {}) {
  return Boolean(
    Array.isArray(value?.commits) ||
    value?.pillars ||
    Array.isArray(value?.memoryEvidences)
  );
}

async function buildProjectEvidenceSeedIfAvailable(context = {}, deps = {}, triggerDecision = {}) {
  if (!triggerDecision?.shouldBuild) {
    return null;
  }

  if (
    context?.projectMemoryEvidenceSeed ||
    deps?.projectMemoryEvidenceSeed ||
    context?.projectMemoryEvidencePack ||
    context?.projectEvidencePack
  ) {
    return null;
  }

  const seedInput = {
    projectKey: context?.projectKey || "garya-bot",
    repository: context?.repository || "korzh260609-beep/garya-bot",
    ref: context?.ref || "main",
    commitLimit: context?.commitLimit ?? 5,
  };

  const cached = getCachedSeed(seedInput, { ttlMs: deps?.projectEvidenceSeedCacheTtlMs ?? 60_000 });
  if (cached) {
    return {
      ...cached,
      cacheHit: true,
    };
  }

  if (typeof deps?.buildProjectEvidenceSeed !== "function") {
    return null;
  }

  const seed = await deps.buildProjectEvidenceSeed(seedInput);
  if (seed) {
    return setCachedSeed(seedInput, {
      ...seed,
      cacheHit: false,
    });
  }

  return null;
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

  const coreMeaning = understandMeaning({
    text: trimmed,
    hasActiveProjectSession: Boolean(
      context?.hasActiveProjectSession ||
      deps?.hasActiveProjectSession
    ),
  });

  const projectMeaning = understandProjectMeaning({
    text: trimmed,
    hasActiveProjectSession: Boolean(
      context?.hasActiveProjectSession ||
      deps?.hasActiveProjectSession
    ),
  });

  const projectContextEngine = new ProjectContextEngine();
  const preProjectContextDecision = projectContextEngine.classifyProjectContextNeed({
    text: trimmed,
    hasActiveProjectSession: Boolean(
      context?.hasActiveProjectSession ||
      deps?.hasActiveProjectSession
    ),
  });

  const triggerDecision = new ProjectEvidenceTriggerPolicy().shouldBuildEvidence({
    projectContextDecision: context?.projectContextDecision || preProjectContextDecision,
    hasExistingEvidencePack: Boolean(
      context?.projectMemoryEvidencePack ||
      context?.projectEvidencePack
    ),
    force: Boolean(context?.forceProjectEvidence || deps?.forceProjectEvidence),
  });

  let evidencePackBuilt = false;
  let evidenceSeedBuilt = false;
  let enrichedContext = {
    ...context,
    coreMeaning,
    projectMeaning,
    projectContextDecision: context?.projectContextDecision || preProjectContextDecision,
    projectMemoryEvidenceTriggerDecision: triggerDecision,
  };

  try {
    if (triggerDecision.shouldBuild) {
      const evidenceSeed = await buildProjectEvidenceSeedIfAvailable(enrichedContext, deps, triggerDecision);
      if (evidenceSeed) {
        evidenceSeedBuilt = true;
        enrichedContext = {
          ...enrichedContext,
          projectMemoryEvidenceSeed: evidenceSeed,
        };
      }

      const evidencePack = buildProjectMemoryEvidencePackIfAvailable(enrichedContext, deps);
      if (evidencePack) {
        evidencePackBuilt = true;
        enrichedContext = {
          ...enrichedContext,
          projectMemoryEvidencePack: evidencePack,
        };
      }
    }
  } catch (e) {
    console.error("project memory evidence build failed (fail-open):", e);
  }

  const projectEvidenceDiagnostics = {
    projectEvidenceTriggered: triggerDecision.shouldBuild === true,
    projectEvidenceSeedBuilt: evidenceSeedBuilt,
    projectEvidencePackBuilt: evidencePackBuilt,
    projectEvidenceSeedPresent: Boolean(
      enrichedContext?.projectMemoryEvidenceSeed || deps?.projectMemoryEvidenceSeed
    ),
    projectEvidenceSeedCacheHit: enrichedContext?.projectMemoryEvidenceSeed?.cacheHit === true,
    projectEvidencePackPresent: Boolean(
      enrichedContext?.projectMemoryEvidencePack ||
      enrichedContext?.projectEvidencePack
    ),
    projectEvidencePackSource: enrichedContext?.projectMemoryEvidencePack?.source || enrichedContext?.projectEvidencePack?.source || null,
    projectEvidenceTriggerReasons: Array.isArray(triggerDecision?.reasons) ? triggerDecision.reasons : [],
  };

  enrichedContext = {
    ...enrichedContext,
    projectEvidenceDiagnostics,
  };

  // =========================================================================
  // STAGE 6.8 — Enforced guard: no processing without dedupe key/messageId
  // =========================================================================
  if (isEnforced) {
    const dedupeKey = enrichedContext?.dedupeKey || null;
    if (!dedupeKey || !messageId) {
      try {
        if (isTransportTraceEnabled()) {
          console.warn("ENFORCED_DROP_NO_DEDUPE", {
            transport,
            chatId,
            senderId,
            messageId,
            dedupeKey,
          });
        }
      } catch (_) {}
      return { ok: false, reason: "missing_dedupeKey", stage: "6.8" };
    }

    // =========================================================================
    // STAGE 8D — In-memory dedupe drop
    // =========================================================================
    try {
      if (!bypassParsed.isBypass) {
        const now = Date.now();
        const key = String(dedupeKey);

        if (dedupeSeenHasFresh(key, now)) {
          if (isTransportTraceEnabled()) {
            console.warn("ENFORCED_DROP_DUPLICATE", {
              transport,
              chatId,
              senderId,
              messageId,
              dedupeKey: key,
            });
          }
          return { ok: true, stage: "8D", result: "dup_drop" };
        }

        dedupeRemember(key, now);
      }
    } catch (e) {
      try {
        console.error("dedupe guard failed (fail-open):", e);
      } catch (_) {}
    }
  }

  // =========================================================================
  // STAGE 6 LOGIC STEP 1 — Identity + Access
  // =========================================================================
  const identity = await resolveIdentityAndAccess({
    transport,
    senderId,
    raw,
    globalUserId,
  });

  globalUserId = identity.globalUserId;

  const {
    accessPack,
    userRole,
    userPlan,
    user,
    isMonarchUser,
  } = identity;

  // =========================================================================
  // STAGE 6 LOGIC STEP 2 — Routing parse
  // =========================================================================
  const routing = parseCommandAccess({
    trimmed,
    user,
    isMonarchUser,
  });

  const {
    isCommand,
    parsed,
    cmdBase,
    rest,
    canProceed,
  } = routing;

  // =========================================================================
  // Trace log
  // =========================================================================
  try {
    if (isTransportTraceEnabled()) {
      console.log("📨 handleMessage(core)", {
        transport,
        chatId,
        senderId,
        globalUserId,
        chatType,
        isPrivateChat,
        isMonarchUser,
        userRole,
        isCommand,
        cmdBase,
        canProceed,
        isEnforced,
        coreMeaningDomain: enrichedContext?.coreMeaning?.domain,
        coreMeaningIntent: enrichedContext?.coreMeaning?.intent,
        coreMeaningSuggestedAction: enrichedContext?.coreMeaning?.suggestedAction,
        coreMeaningEnoughInformation: enrichedContext?.coreMeaning?.enoughInformation,
        coreMeaningMissingInformation: enrichedContext?.coreMeaning?.missingInformation,
        projectMeaningIntent: enrichedContext?.projectMeaning?.intent,
        projectMeaningConfidence: enrichedContext?.projectMeaning?.confidence,
        projectMeaningEnoughInformation: enrichedContext?.projectMeaning?.enoughInformation,
        projectMeaningMissingInformation: enrichedContext?.projectMeaning?.missingInformation,
        projectContextDepth: enrichedContext?.projectContextDecision?.depth,
        projectContextTrigger: enrichedContext?.projectContextDecision?.trigger,
        projectEvidenceTriggered: projectEvidenceDiagnostics.projectEvidenceTriggered,
        projectEvidenceSeedBuilt: projectEvidenceDiagnostics.projectEvidenceSeedBuilt,
        projectEvidencePackBuilt: projectEvidenceDiagnostics.projectEvidencePackBuilt,
        projectEvidenceSeedPresent: projectEvidenceDiagnostics.projectEvidenceSeedPresent,
        projectEvidenceSeedCacheHit: projectEvidenceDiagnostics.projectEvidenceSeedCacheHit,
        projectEvidencePackPresent: projectEvidenceDiagnostics.projectEvidencePackPresent,
        projectEvidencePackSource: projectEvidenceDiagnostics.projectEvidencePackSource,
        projectEvidenceTriggerReasons: projectEvidenceDiagnostics.projectEvidenceTriggerReasons,
      });
    }
  } catch {
    // ignore
  }

  // =========================================================================
  // STAGE 7.1 — Memory shadow write (OFF by default)
  // =========================================================================
  try {
    const memory = getMemoryService();
    const enabled = Boolean(memory?.config?.enabled);
    const shadowWriteEnabled = envBool("MEMORY_SHADOW_WRITE", false);

    if (!isEnforced && enabled && shadowWriteEnabled && chatId && messageId && text) {
      await memory.write({
        chatId,
        globalUserId: globalUserId || null,
        role: "user",
        content: text,
        transport,
        metadata: {
          messageId,
          source: "core.handleMessage.shadow",
          chatType,
          isPrivateChat,
        },
        schemaVersion: 2,
      });
    }
  } catch (e) {
    console.error("handleMessage(memory shadow) failed:", e);
  }

  // =========================================================================
  // Shadow mode: compute routing but don't act
  // =========================================================================
  if (!isEnforced) {
    return {
      ok: true,
      stage: "6.shadow",
      note: "routing computed (shadow). deps not provided — no reply.",
      transport,
      userRole,
      isMonarchUser,
      isCommand,
      cmdBase,
      canProceed,
      coreMeaning: enrichedContext?.coreMeaning || null,
      projectMeaning: enrichedContext?.projectMeaning || null,
      projectContextDecision: enrichedContext?.projectContextDecision || null,
      projectMemoryEvidenceTriggerDecision: enrichedContext?.projectMemoryEvidenceTriggerDecision || null,
      projectEvidenceDiagnostics,
    };
  }

  // =========================================================================
  // ENFORCED MODE — real routing + reply
  // =========================================================================
  const chatIdNum = chatId ? Number(chatId) : null;
  const chatIdStr = chatId || "";

  if (!chatIdNum) {
    return { ok: false, reason: "missing_chatId" };
  }

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
      accessPack,
      parsed,
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
