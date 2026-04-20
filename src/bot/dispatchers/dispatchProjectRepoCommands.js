// src/bot/dispatchers/dispatchProjectRepoCommands.js
// ============================================================================
// PROJECT REPO COMMANDS DISPATCHER
// - extracted 1:1 from commandDispatcher
// - NO logic changes
// - ONLY routing isolation
// ============================================================================

import { handleRepoStatus } from "../handlers/repoStatus.js";
import { handleWorkflowCheck } from "../handlers/workflowCheck.js";
import { handleStageCheck } from "../handlers/stageCheck.js";
import { handleReindexRepo } from "../handlers/reindexRepo.js";
import { handleRepoTree } from "../handlers/repoTree.js";
import { handleRepoFile } from "../handlers/repoFile.js";
import { handleRepoAnalyze } from "../handlers/repoAnalyze.js";
import { handleRepoDiff } from "../handlers/repoDiff.js";
import { handleRepoSearch } from "../handlers/repoSearch.js";
import { handleRepoGet } from "../handlers/repoGet.js";
import { handleRepoCheck } from "../handlers/repoCheck.js";
import { handleRepoReview } from "../handlers/repoReview.js";
import { handleRepoReview2 } from "../handlers/repoReview2.js";
import { handleCodeOutputStatus } from "../handlers/codeOutputStatus.js";
import { handleProjectIntentDiag } from "../handlers/projectIntentDiag.js";

function buildProjectRepoHandlerCtx(ctx, reply) {
  return {
    bot: ctx.bot,
    chatId: ctx.chatId,
    chatIdStr: ctx.chatIdStr,
    senderIdStr: ctx.senderIdStr,
    rest: ctx.rest,
    user: ctx.user,
    userRole: ctx.userRole,
    userPlan: ctx.userPlan,
    globalUserId: ctx.globalUserId ?? ctx?.user?.global_user_id ?? null,
    isMonarchUser:
      typeof ctx.isMonarchUser === "boolean" ? ctx.isMonarchUser : !!ctx.bypass,
    isPrivateChat:
      typeof ctx.isPrivateChat === "boolean"
        ? ctx.isPrivateChat
        : ctx?.identityCtx?.isPrivateChat === true,
    transport: ctx?.identityCtx?.transport || ctx.transport || "telegram",
    chatType:
      ctx.chatType ||
      ctx?.identityCtx?.chatType ||
      ctx?.identityCtx?.chat_type ||
      null,
    identityCtx: ctx.identityCtx,
    reply,
  };
}

export async function dispatchProjectRepoCommands({ cmd0, ctx, reply }) {
  const baseCtx = buildProjectRepoHandlerCtx(ctx, reply);

  switch (cmd0) {
    case "/reindex": {
      await handleReindexRepo(baseCtx);
      return { handled: true };
    }

    case "/repo_status": {
      await handleRepoStatus(baseCtx);
      return { handled: true };
    }

    case "/repo_tree": {
      await handleRepoTree(baseCtx);
      return { handled: true };
    }

    case "/repo_file": {
      await handleRepoFile(baseCtx);
      return { handled: true };
    }

    case "/repo_analyze": {
      await handleRepoAnalyze(baseCtx);
      return { handled: true };
    }

    case "/repo_diff": {
      await handleRepoDiff(baseCtx);
      return { handled: true };
    }

    case "/repo_search": {
      await handleRepoSearch(baseCtx);
      return { handled: true };
    }

    case "/repo_get": {
      await handleRepoGet(baseCtx);
      return { handled: true };
    }

    case "/repo_check": {
      await handleRepoCheck(baseCtx);
      return { handled: true };
    }

    case "/repo_review": {
      await handleRepoReview(baseCtx);
      return { handled: true };
    }

    case "/repo_review2": {
      await handleRepoReview2(baseCtx);
      return { handled: true };
    }

    case "/code_output_status": {
      await handleCodeOutputStatus(baseCtx);
      return { handled: true };
    }

    case "/project_intent_diag": {
      await handleProjectIntentDiag(baseCtx);
      return { handled: true };
    }

    case "/workflow_check": {
      await handleWorkflowCheck(baseCtx);
      return { handled: true };
    }

    case "/stage_check": {
      await handleStageCheck(baseCtx);
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

export default {
  dispatchProjectRepoCommands,
};