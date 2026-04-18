// src/core/projectIntent/projectIntentRepoBridge.js
// ============================================================================
// STAGE 12A.0 — project repo bridge plan (SKELETON)
// Purpose:
// - convert internal SG read-plan into a normalized repo bridge plan
// - prepare future human-text -> repo command/handler execution
// - keep this layer semantic and read-only
// IMPORTANT:
// - NO command execution
// - NO repo writes
// - NO side effects
// - planning only
// ============================================================================

function safeString(value) {
  return String(value ?? "").trim();
}

function quoteIfNeeded(value) {
  const text = safeString(value);
  if (!text) return "";
  return /\s/.test(text) ? `"${text}"` : text;
}

function buildCommandText(command, arg = "") {
  const cmd = safeString(command);
  const rest = safeString(arg);
  if (!cmd) return "";
  if (!rest) return cmd;
  return `${cmd} ${rest}`;
}

function resolveSearchArg(readPlan = {}) {
  const primaryPathHint = safeString(readPlan.primaryPathHint);
  if (primaryPathHint) return primaryPathHint;

  const hints = Array.isArray(readPlan.queryHints) ? readPlan.queryHints : [];
  const filtered = hints
    .map((item) => safeString(item))
    .filter(Boolean)
    .filter((item) => item.length >= 2);

  return filtered[0] || "";
}

function resolveFileArg(readPlan = {}) {
  return safeString(readPlan.primaryPathHint);
}

function resolveAnalyzeArg(readPlan = {}) {
  // IMPORTANT:
  // current /repo_analyze handler expects PATH first, not generic search text
  return safeString(readPlan.primaryPathHint);
}

function resolveWorkflowArg(readPlan = {}) {
  // Future:
  // workflow free-text may later parse concrete step code
  // Right now we do not guess step IDs.
  return "";
}

function resolveDiffArg(_readPlan = {}) {
  // Future:
  // /repo_diff may require more explicit parsing.
  // Do not invent arguments here.
  return "";
}

function resolveBridgePreview({ handlerKey, commandText, confidence }) {
  const handler = safeString(handlerKey) || "unknown_handler";
  const command = safeString(commandText) || "(no command)";
  const conf = safeString(confidence) || "low";

  return `${handler} -> ${command} [${conf}]`;
}

export function resolveProjectIntentRepoBridge({
  route = null,
  readPlan = null,
} = {}) {
  const routeKey = safeString(route?.routeKey);
  const routeAllowsInternalRead = routeKey === "sg_core_internal_read_allowed";

  const planKey = safeString(readPlan?.planKey);
  let handlerKey = "repoSearch";
  let recommendedCommand = "/repo_search";
  let commandArg = "";
  let confidence = safeString(readPlan?.confidence) || "low";
  let basis = [];

  if (planKey === "workflow_check") {
    handlerKey = "workflowCheck";
    recommendedCommand = "/workflow_check";
    commandArg = resolveWorkflowArg(readPlan);
    basis = ["workflow_check_bridge"];
    if (!commandArg) {
      basis.push("missing_workflow_step");
    }
  } else if (planKey === "stage_check") {
    handlerKey = "stageCheck";
    recommendedCommand = "/stage_check";
    basis = ["stage_check_bridge"];
  } else if (planKey === "repo_status") {
    handlerKey = "repoStatus";
    recommendedCommand = "/repo_status";
    basis = ["repo_status_bridge"];
  } else if (planKey === "repo_tree") {
    handlerKey = "repoTree";
    recommendedCommand = "/repo_tree";
    basis = ["repo_tree_bridge"];
  } else if (planKey === "repo_file") {
    handlerKey = "repoFile";
    recommendedCommand = "/repo_file";
    commandArg = resolveFileArg(readPlan);
    basis = ["repo_file_bridge"];
    if (!commandArg) {
      confidence = "low";
      basis.push("missing_path_hint");
    }
  } else if (planKey === "repo_diff") {
    handlerKey = "repoDiff";
    recommendedCommand = "/repo_diff";
    commandArg = resolveDiffArg(readPlan);
    basis = ["repo_diff_bridge"];
    if (!commandArg) {
      basis.push("missing_diff_target");
    }
  } else if (planKey === "repo_analyze") {
    handlerKey = "repoAnalyze";
    recommendedCommand = "/repo_analyze";
    commandArg = resolveAnalyzeArg(readPlan);
    basis = ["repo_analyze_bridge"];
    if (!commandArg) {
      confidence = "low";
      basis.push("missing_analyze_path");
    }
  } else if (planKey === "repo_search") {
    handlerKey = "repoSearch";
    recommendedCommand = "/repo_search";
    commandArg = resolveSearchArg(readPlan);
    basis = ["repo_search_bridge"];
    if (!commandArg) {
      confidence = "low";
      basis.push("missing_search_arg");
    }
  } else {
    handlerKey = "repoSearch";
    recommendedCommand = "/repo_search";
    commandArg = resolveSearchArg(readPlan);
    basis = ["generic_internal_repo_bridge"];
    if (!commandArg) {
      confidence = "low";
      basis.push("missing_generic_search_arg");
    }
  }

  const normalizedArg = quoteIfNeeded(commandArg);
  const commandText = buildCommandText(recommendedCommand, normalizedArg);

  const canAutoExecute =
    routeAllowsInternalRead &&
    (
      recommendedCommand === "/stage_check" ||
      recommendedCommand === "/repo_status" ||
      recommendedCommand === "/repo_tree" ||
      (recommendedCommand === "/repo_file" && !!safeString(commandArg)) ||
      (recommendedCommand === "/repo_search" && !!safeString(commandArg)) ||
      (recommendedCommand === "/repo_analyze" && !!safeString(commandArg))
    );

  return {
    routeAllowsInternalRead,
    planKey,

    handlerKey,
    recommendedCommand,
    commandArg: safeString(commandArg),
    commandText,

    canAutoExecute,
    confidence,
    basis,

    preview: resolveBridgePreview({
      handlerKey,
      commandText,
      confidence,
    }),
  };
}

export default {
  resolveProjectIntentRepoBridge,
};