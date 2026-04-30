// src/core/handleMessage/legacyProjectIntentFlow.js
// ============================================================================
// LEGACY PROJECT INTENT FLOW — ISOLATION BOUNDARY
//
// Purpose:
// - isolate existing projectIntent/repo/diagnostic legacy logic that was mixed
//   directly into handleChatFlow;
// - preserve existing behavior during the first migration step;
// - do not add slash-commands;
// - do not create or expand Technical Mode;
// - do not create new diagnostic bridges.
//
// This file supports the migration documented in:
// pillars/architecture/HANDLE_CHAT_FLOW_ISOLATION_PLAN.md
// ============================================================================

import { ProjectContextEngine } from "../../projectExperience/ProjectContextEngine.js";
import { ProjectMemoryAutoCapture } from "../../projectExperience/ProjectMemoryAutoCapture.js";

import { resolveProjectIntentRoute } from "../projectIntent/projectIntentRoute.js";
import { requireProjectIntentAccess } from "../projectIntent/projectIntentGuard.js";
import { maybeHandleProjectDiagnosticNaturalBridge } from "../projectIntent/projectDiagnosticNaturalBridge.js";
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

export const LEGACY_PROJECT_INTENT_FLOW_STATUS = Object.freeze({
  PREPARED: "prepared",
  HANDLED: "handled",
  NOT_HANDLED: "not_handled",
  BLOCKED: "blocked",
});

export const LEGACY_PROJECT_INTENT_FLOW_PHASE = Object.freeze({
  PREPARE: "prepare",
  CONTINUE: "continue",
});

export function createLegacyProjectIntentFlowInput(input = {}) {
  return {
    phase: safeText(input.phase) || LEGACY_PROJECT_INTENT_FLOW_PHASE.PREPARE,
    text: safeText(input.text ?? input.trimmed),
    trimmed: safeText(input.trimmed ?? input.text),
    transport: safeText(input.transport) || "unknown",
    chatId: safeText(input.chatId ?? input.chatIdStr),
    chatIdStr: safeText(input.chatIdStr ?? input.chatId),
    chatType: safeText(input.chatType),
    globalUserId: safeText(input.globalUserId),
    senderId: safeText(input.senderId),
    messageId: input.messageId ?? null,
    isPrivateChat: input.isPrivateChat === true,
    isMonarchUser: input.isMonarchUser === true,
    userRole: safeText(input.userRole) || "guest",
    context: input.context || {},
    deps: input.deps || {},
    replyAndLog: input.replyAndLog || null,
    memory: input.memory || null,
    prepared: input.prepared || null,
  };
}

async function prepareLegacyProjectIntentFlow(normalized = {}) {
  const {
    memory,
    context,
    deps,
    chatIdStr,
    globalUserId,
    chatType,
    trimmed,
    transport,
    messageId,
    isMonarchUser,
    isPrivateChat,
    replyAndLog,
  } = normalized;

  const projectContextEngine = new ProjectContextEngine();
  const projectMemoryAutoCapture = new ProjectMemoryAutoCapture();

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
      handled: true,
      source: "legacyProjectIntentFlow",
      status: LEGACY_PROJECT_INTENT_FLOW_STATUS.BLOCKED,
      reason: "project_intent_blocked",
      response: {
        ok: true,
        stage: "12A.0.intent_guard",
        result: "project_intent_blocked",
        projectContextDecision,
        projectMemoryAutoCaptureSummary: projectMemoryAutoCaptureMeta,
      },
    };
  }

  const projectDiagnosticNaturalBridgeResult = await maybeHandleProjectDiagnosticNaturalBridge({
    text: projectIntentRoutingText,
    route: projectIntentRoute,
    replyAndLog,
    isMonarchUser: !!isMonarchUser,
    isPrivateChat: !!isPrivateChat,
    transport,
    chatId: chatIdStr,
    globalUserId,
  });

  if (projectDiagnosticNaturalBridgeResult?.handled) {
    return {
      ok: true,
      handled: true,
      source: "legacyProjectIntentFlow",
      status: LEGACY_PROJECT_INTENT_FLOW_STATUS.HANDLED,
      reason: projectDiagnosticNaturalBridgeResult.reason || "project_diagnostic_natural_bridge_handled",
      response: {
        ok: true,
        stage: "12A.1.project_diagnostic_natural_bridge",
        result: projectDiagnosticNaturalBridgeResult.reason || "project_diagnostic_natural_bridge_handled",
        projectContextDecision,
        projectMemoryAutoCaptureSummary: projectMemoryAutoCaptureMeta,
      },
    };
  }

  const prepared = {
    repoFollowupContext,
    pendingChoiceContext,
    projectIntentRoutingText,
    projectContextDecision,
    projectMemoryAutoCaptureMeta,
    projectIntentRoute,
  };

  return {
    ok: true,
    handled: false,
    source: "legacyProjectIntentFlow",
    status: LEGACY_PROJECT_INTENT_FLOW_STATUS.PREPARED,
    reason: "legacy_project_intent_prepared",
    prepared,
    projectIntentRepoContext: repoFollowupContext,
    pendingChoiceContext,
    projectIntentRoutingText,
    projectIntentRoute,
    projectContextDecision,
    projectMemoryAutoCaptureSummary: projectMemoryAutoCaptureMeta,
  };
}

async function continueLegacyProjectIntentFlow(normalized = {}) {
  const {
    memory,
    deps,
    trimmed,
    chatIdStr,
    globalUserId,
    transport,
    replyAndLog,
    prepared,
  } = normalized;

  if (!prepared) {
    return {
      ok: false,
      handled: false,
      source: "legacyProjectIntentFlow",
      status: LEGACY_PROJECT_INTENT_FLOW_STATUS.BLOCKED,
      reason: "missing_prepared_legacy_project_intent_flow",
    };
  }

  const {
    repoFollowupContext,
    pendingChoiceContext,
    projectContextDecision,
    projectMemoryAutoCaptureMeta,
    projectIntentRoute,
  } = prepared;

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
      handled: true,
      source: "legacyProjectIntentFlow",
      status: LEGACY_PROJECT_INTENT_FLOW_STATUS.HANDLED,
      reason: repoConversationResult.reason || "repo_conversation_handled",
      response: {
        ok: true,
        stage: "12A.0.repo_conversation",
        result: repoConversationResult.reason || "repo_conversation_handled",
        projectContextDecision,
        projectMemoryAutoCaptureSummary: projectMemoryAutoCaptureMeta,
      },
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
      handled: true,
      source: "legacyProjectIntentFlow",
      status: LEGACY_PROJECT_INTENT_FLOW_STATUS.HANDLED,
      reason: "internal_project_request_not_auto_executed",
      response: {
        ok: true,
        stage: "12A.0.internal_no_generic_fallback",
        result: "internal_project_request_not_auto_executed",
        projectContextDecision,
        projectMemoryAutoCaptureSummary: projectMemoryAutoCaptureMeta,
      },
    };
  }

  return {
    ok: true,
    handled: false,
    source: "legacyProjectIntentFlow",
    status: LEGACY_PROJECT_INTENT_FLOW_STATUS.NOT_HANDLED,
    reason: "legacy_project_intent_not_handled",
    projectIntentRepoContext: repoFollowupContext,
    projectContextDecision,
    projectMemoryAutoCaptureSummary: projectMemoryAutoCaptureMeta,
  };
}

export async function handleLegacyProjectIntentFlow(input = {}) {
  const normalized = createLegacyProjectIntentFlowInput(input);

  if (normalized.phase === LEGACY_PROJECT_INTENT_FLOW_PHASE.CONTINUE) {
    return continueLegacyProjectIntentFlow(normalized);
  }

  return prepareLegacyProjectIntentFlow(normalized);
}

export default {
  LEGACY_PROJECT_INTENT_FLOW_STATUS,
  LEGACY_PROJECT_INTENT_FLOW_PHASE,
  createLegacyProjectIntentFlowInput,
  handleLegacyProjectIntentFlow,
};
