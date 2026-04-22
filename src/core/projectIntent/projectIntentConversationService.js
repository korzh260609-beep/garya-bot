// src/core/projectIntent/projectIntentConversationService.js
// ============================================================================
// STAGE 12A.0 — human-first repo conversation layer
// Orchestrator only
// Meaning → intent → decision → action → response
// ============================================================================

import { resolveProjectIntentSemanticPlan } from "./projectIntentSemanticResolver.js";
import {
  humanClarificationReply,
  replyHuman,
  buildRepoContextMeta,
} from "./projectIntentConversationReplies.js";
import {
  safeText,
} from "./projectIntentConversationShared.js";
import {
  buildProjectIntentRoutingText,
  getLatestProjectIntentRepoContext,
  getLatestProjectIntentPendingChoice,
} from "./conversation/projectIntentConversationExports.js";
import {
  basenameNoExt,
  shouldForceActiveFileExplain,
} from "./conversation/projectIntentConversationHelpers.js";
import {
  replyContinuation,
  replyExplainFileFromPath,
} from "./conversation/projectIntentConversationRepliesRuntime.js";
import { prepareRepoConversationRuntime } from "./conversation/projectIntentConversationBootstrap.js";
import {
  handleRepoStatusIntent,
  handleShowTreeIntent,
  handleBrowseFolderIntent,
  handleFindTargetIntent,
  handleFindAndExplainIntent,
} from "./conversation/projectIntentConversationRepoActions.js";
import {
  handleOpenTargetIntent,
  handleExplainLikeIntent,
} from "./conversation/projectIntentConversationObjectActions.js";

export {
  buildProjectIntentRoutingText,
  getLatestProjectIntentRepoContext,
  getLatestProjectIntentPendingChoice,
};

export async function runProjectIntentConversationFlow({
  trimmed,
  route,
  followupContext,
  pendingChoiceContext,
  replyAndLog,
  callAI,
}) {
  const runtime = await prepareRepoConversationRuntime({
    route,
    replyAndLog,
  });

  if (!runtime.ok) {
    return {
      handled: runtime.handled,
      reason: runtime.reason,
    };
  }

  const {
    snapshotState,
    latest,
    repo,
    branch,
    token,
  } = runtime;

  const semanticPlan = await resolveProjectIntentSemanticPlan({
    text: trimmed,
    callAI,
    followupContext,
    pendingChoiceContext,
  });

  const activeFileFollowup = shouldForceActiveFileExplain({
    trimmed,
    followupContext,
    semanticPlan,
  });

  if (activeFileFollowup) {
    return replyExplainFileFromPath({
      replyAndLog,
      trimmed,
      targetPath: followupContext?.targetPath,
      targetEntity: followupContext?.targetEntity || basenameNoExt(followupContext?.targetPath),
      displayMode: safeText(followupContext?.displayMode) || "explain",
      sourceText: trimmed,
      semanticConfidence: "high",
      actionKind: "explain_active",
      repo,
      branch,
      token,
      callAI,
      event: "repo_conversation_explain_active_file_followup",
      projectContextScope: semanticPlan?.projectContextScope || followupContext?.projectContextScope || {},
    });
  }

  if (semanticPlan?.clarifyNeeded === true) {
    const text = humanClarificationReply(semanticPlan?.clarifyQuestion);

    const contextMeta = buildRepoContextMeta({
      targetEntity: semanticPlan?.targetEntity,
      targetPath: semanticPlan?.targetPath,
      displayMode: semanticPlan?.displayMode,
      sourceText: trimmed,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: semanticPlan?.intent,
      projectContextScope: semanticPlan?.projectContextScope || followupContext?.projectContextScope || {},
    });

    contextMeta.projectIntentObjectKind = safeText(semanticPlan?.objectKind);

    await replyHuman(replyAndLog, text, {
      event: "repo_conversation_clarification",
      ...contextMeta,
    });

    return {
      handled: true,
      reason: "clarification_replied",
      contextMeta,
    };
  }

  if (semanticPlan.intent === "continue_active") {
    return replyContinuation({
      replyAndLog,
      followupContext,
      sourceText: trimmed,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: "continue_active",
      event: "repo_conversation_continue_active",
      projectContextScope: semanticPlan?.projectContextScope || followupContext?.projectContextScope || {},
    });
  }

  if (semanticPlan.intent === "repo_status") {
    return handleRepoStatusIntent({
      replyAndLog,
      trimmed,
      semanticPlan,
      latest,
      snapshotState,
    });
  }

  if (semanticPlan.intent === "show_tree") {
    return handleShowTreeIntent({
      replyAndLog,
      trimmed,
      semanticPlan,
      followupContext,
      latest,
    });
  }

  if (semanticPlan.intent === "browse_folder") {
    return handleBrowseFolderIntent({
      replyAndLog,
      trimmed,
      semanticPlan,
      followupContext,
      latest,
    });
  }

  if (semanticPlan.intent === "find_target") {
    return handleFindTargetIntent({
      replyAndLog,
      trimmed,
      semanticPlan,
      latest,
    });
  }

  if (semanticPlan.intent === "find_and_explain") {
    return handleFindAndExplainIntent({
      replyAndLog,
      trimmed,
      semanticPlan,
      followupContext,
      pendingChoiceContext,
      latest,
      callAI,
      repo,
      branch,
      token,
    });
  }

  if (semanticPlan.intent === "open_target") {
    return handleOpenTargetIntent({
      replyAndLog,
      trimmed,
      semanticPlan,
      followupContext,
      pendingChoiceContext,
      latest,
      repo,
      branch,
      token,
    });
  }

  if (
    semanticPlan.intent === "explain_target" ||
    semanticPlan.intent === "explain_active" ||
    semanticPlan.intent === "answer_pending_choice"
  ) {
    return handleExplainLikeIntent({
      replyAndLog,
      trimmed,
      semanticPlan,
      followupContext,
      pendingChoiceContext,
      latest,
      callAI,
      repo,
      branch,
      token,
    });
  }

  return {
    handled: false,
    reason: "conversation_layer_skipped",
  };
}

export default {
  buildProjectIntentRoutingText,
  getLatestProjectIntentRepoContext,
  getLatestProjectIntentPendingChoice,
  runProjectIntentConversationFlow,
};