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
import { getCachedSeed, setCachedSeed } from "../projectExperience/ProjectEvidenceSeedCache.js";
import { understandMeaning } from "./meaning/MeaningEngine.js";
import { selectToolsForMeaning } from "./meaning/ToolSelectionEngine.js";

function hasProjectEvidenceSeed(value = {}) {
  return Boolean(
    Array.isArray(value?.commits) ||
    value?.pillars ||
    Array.isArray(value?.memoryEvidences)
  );
}

function buildMeaningPreviousContextHint(context = {}, deps = {}) {
  return {
    projectContextDecision: context?.projectContextDecision || null,
    projectMemoryEvidencePack: context?.projectMemoryEvidencePack || context?.projectEvidencePack || null,
    projectMemoryEvidenceSeed: context?.projectMemoryEvidenceSeed || deps?.projectMemoryEvidenceSeed || null,
    hasActiveProjectSession: Boolean(context?.hasActiveProjectSession || deps?.hasActiveProjectSession),
  };
}

function shouldAllowProjectContextFromMeaning(coreMeaning = {}) {
  if (!coreMeaning || typeof coreMeaning !== "object") return false;
  if (coreMeaning.suggestedAction === "clarify") return false;
  if (coreMeaning.domain !== "project") return false;
  return Boolean(
    coreMeaning.suggestedAction === "use_tool" ||
    coreMeaning.intent === "project_message" ||
    coreMeaning.contextContinuity?.canUsePreviousTarget === true
  );
}

async function buildNaturalClarificationReply({ deps = {}, text = "", coreMeaning = {} } = {}) {
  const fallback = "Уточни, пожалуйста, какой именно объект нужно проверить.";

  if (typeof deps?.callAI !== "function") {
    return fallback;
  }

  try {
    const reply = await deps.callAI([
      {
        role: "system",
        content: [
          "You are SG, a concise project assistant.",
          "Generate a short natural clarification question in the user's language.",
          "Do not use a fixed template.",
          "Do not invent missing information.",
          "Do not execute the task.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          userMessage: text,
          meaning: {
            intent: coreMeaning?.intent,
            userMeaning: coreMeaning?.userMeaning,
            missingInformation: coreMeaning?.missingInformation,
            contextContinuity: coreMeaning?.contextContinuity,
          },
        }),
      },
    ]);

    return String(reply || "").trim() || fallback;
  } catch (e) {
    console.error("core meaning clarification AI failed (fail-open):", e);
    return fallback;
  }
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

  // =========================================================================
  // CORE MEANING — Understand message intent before project/evidence logic
  // =========================================================================
  const coreMeaning = understandMeaning({
    text: trimmed,
    hasActiveProjectSession: Boolean(
      context?.hasActiveProjectSession ||
      deps?.hasActiveProjectSession
    ),
    previousContext: buildMeaningPreviousContextHint(context, deps),
  });

  // =========================================================================
  // CORE MEANING — ToolSelection dry-run planner, no execution
  // =========================================================================
  const toolSelection = selectToolsForMeaning({ meaning: coreMeaning });

  const projectContextAllowedByMeaning = shouldAllowProjectContextFromMeaning(coreMeaning);

  // =========================================================================
  // PROJECT CONTEXT — Controlled by structured core meaning
  // =========================================================================
  const projectContextEngine = new ProjectContextEngine();
  const preProjectContextDecision = projectContextAllowedByMeaning
    ? projectContextEngine.classifyProjectContextNeed({
        text: trimmed,
        hasActiveProjectSession: Boolean(
          context?.hasActiveProjectSession ||
          deps?.hasActiveProjectSession
        ),
      })
    : {
        depth: "none",
        trigger: "unknown",
        stageKey: null,
        reasons: ["blocked_by_core_meaning"],
      };

  // =========================================================================
  // PROJECT EVIDENCE — Trigger policy only, no DB writes
  // =========================================================================
  const triggerDecision = projectContextAllowedByMeaning
    ? new ProjectEvidenceTriggerPolicy().shouldBuildEvidence({
        projectContextDecision: context?.projectContextDecision || preProjectContextDecision,
        hasExistingEvidencePack: Boolean(
          context?.projectMemoryEvidencePack ||
          context?.projectEvidencePack
        ),
        force: Boolean(context?.forceProjectEvidence || deps?.forceProjectEvidence),
      })
    : {
        shouldBuild: false,
        depth: "none",
        trigger: "unknown",
        reasons: ["blocked_by_core_meaning"],
      };

  let evidencePackBuilt = false;
  let evidenceSeedBuilt = false;
  let enrichedContext = {
    ...context,
    coreMeaning,
    toolSelection,
    projectContextAllowedByMeaning,
    projectContextDecision: context?.projectContextDecision || preProjectContextDecision,
    projectMemoryEvidenceTriggerDecision: triggerDecision,
  };

  // =========================================================================
  // PROJECT EVIDENCE — Seed/cache/light-pack build, fail-open
  // =========================================================================
  try {
    if (triggerDecision.shouldBuild && coreMeaning?.suggestedAction !== "clarify") {
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
        contextContinuityStrength: enrichedContext?.coreMeaning?.contextContinuity?.contextStrength,
        contextContinuityCanUsePreviousTarget: enrichedContext?.coreMeaning?.contextContinuity?.canUsePreviousTarget,
        contextContinuityShouldAskClarification: enrichedContext?.coreMeaning?.contextContinuity?.shouldAskClarification,
        toolSelectionStatus: enrichedContext?.toolSelection?.status,
        toolSelectionTools: enrichedContext?.toolSelection?.selectedTools,
        projectContextAllowedByMeaning: enrichedContext?.projectContextAllowedByMeaning,
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
  // STAGE CORE MEANING — Natural clarification guard
  // =========================================================================
  if (isEnforced && coreMeaning?.suggestedAction === "clarify" && !isCommand) {
    const chatIdNumForClarify = chatId ? Number(chatId) : null;
    const chatIdStrForClarify = chatId || "";

    if (!chatIdNumForClarify) {
      return { ok: false, reason: "missing_chatId" };
    }

    const replyAndLog = buildReplyAndLog({
      deps,
      context: enrichedContext,
      transport,
      chatIdStr: chatIdStrForClarify,
      chatType,
      globalUserId,
      senderId,
      messageId,
    });

    const clarificationReply = await buildNaturalClarificationReply({
      deps,
      text: trimmed,
      coreMeaning,
    });

    if (typeof replyAndLog === "function") {
      await replyAndLog(clarificationReply, {
        handler: "handleMessage",
        event: "core_meaning_clarification",
        core_meaning_intent: coreMeaning?.intent,
        core_meaning_missing_information: coreMeaning?.missingInformation,
        core_meaning_context_continuity: coreMeaning?.contextContinuity,
        transport_agnostic: true,
      });
    }

    return {
      ok: true,
      stage: "core.meaning.clarify",
      result: "clarification_requested",
      coreMeaning,
    };
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
      toolSelection: enrichedContext?.toolSelection || null,
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
