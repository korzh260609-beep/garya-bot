// ============================================================================
// === src/bot/handlers/projectIntentRepoExecutor.js
// === 12A.0 repo bridge executor (SKELETON, READ-ONLY)
// Purpose:
// - execute normalized repo bridge plan using existing read-only handlers
// - keep one thin adapter from bridge semantics to current Telegram handlers
// IMPORTANT:
// - READ-ONLY only
// - no repo writes
// - handlers still keep their own monarch/private guards
// - this file does not decide policy; it only dispatches a safe bridge
// ============================================================================

import { handleWorkflowCheck } from "./workflowCheck.js";
import { handleStageCheck } from "./stageCheck.js";
import { handleRepoStatus } from "./repoStatus.js";
import { handleRepoTree } from "./repoTree.js";
import { handleRepoFile } from "./repoFile.js";
import { handleRepoSearch } from "./repoSearch.js";
import { handleRepoAnalyze } from "./repoAnalyze.js";
import { handleRepoDiff } from "./repoDiff.js";

function safeString(value) {
  return String(value ?? "").trim();
}

function buildExecutionCtx(ctx = {}, bridge = {}) {
  return {
    ...ctx,
    rest: safeString(bridge.commandArg),
  };
}

export async function executeProjectIntentRepoBridge(ctx = {}, bridge = {}) {
  const handlerKey = safeString(bridge.handlerKey);
  const canAutoExecute = bridge?.canAutoExecute === true;

  if (!canAutoExecute) {
    return {
      executed: false,
      skipped: true,
      reason: "bridge_not_auto_executable",
      handlerKey,
    };
  }

  const nextCtx = buildExecutionCtx(ctx, bridge);

  if (handlerKey === "workflowCheck") {
    await handleWorkflowCheck(nextCtx);
    return {
      executed: true,
      skipped: false,
      reason: "workflow_check_executed",
      handlerKey,
    };
  }

  if (handlerKey === "stageCheck") {
    await handleStageCheck(nextCtx);
    return {
      executed: true,
      skipped: false,
      reason: "stage_check_executed",
      handlerKey,
    };
  }

  if (handlerKey === "repoStatus") {
    await handleRepoStatus(nextCtx);
    return {
      executed: true,
      skipped: false,
      reason: "repo_status_executed",
      handlerKey,
    };
  }

  if (handlerKey === "repoTree") {
    await handleRepoTree(nextCtx);
    return {
      executed: true,
      skipped: false,
      reason: "repo_tree_executed",
      handlerKey,
    };
  }

  if (handlerKey === "repoFile") {
    await handleRepoFile(nextCtx);
    return {
      executed: true,
      skipped: false,
      reason: "repo_file_executed",
      handlerKey,
    };
  }

  if (handlerKey === "repoSearch") {
    await handleRepoSearch(nextCtx);
    return {
      executed: true,
      skipped: false,
      reason: "repo_search_executed",
      handlerKey,
    };
  }

  if (handlerKey === "repoAnalyze") {
    await handleRepoAnalyze(nextCtx);
    return {
      executed: true,
      skipped: false,
      reason: "repo_analyze_executed",
      handlerKey,
    };
  }

  if (handlerKey === "repoDiff") {
    await handleRepoDiff(nextCtx);
    return {
      executed: true,
      skipped: false,
      reason: "repo_diff_executed",
      handlerKey,
    };
  }

  return {
    executed: false,
    skipped: true,
    reason: "unknown_bridge_handler",
    handlerKey,
  };
}

export default {
  executeProjectIntentRepoBridge,
};