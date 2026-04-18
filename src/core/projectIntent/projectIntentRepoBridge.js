// src/core/projectIntent/projectIntentRepoBridge.js
// ============================================================================
// STAGE 12A.0 — project repo bridge plan (SKELETON, semantic-first + follow-up)
// Purpose:
// - convert internal SG read-plan into a normalized repo bridge plan
// - use semantic target fields first, not noisy query words
// - support repo_analyze <path> [question...]
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

function resolveCanonicalPillarPath(readPlan = {}) {
  return safeString(readPlan.canonicalPillarPath);
}

function resolveSearchArg(readPlan = {}) {
  const canonicalPillarPath = resolveCanonicalPillarPath(readPlan);
  if (canonicalPillarPath) return canonicalPillarPath;

  const targetPath = safeString(readPlan.targetPath);
  if (targetPath) return targetPath;

  const targetEntity = safeString(readPlan.targetEntity);
  if (targetEntity) return targetEntity;

  const primaryPathHint = safeString(readPlan.primaryPathHint);
  if (primaryPathHint) return primaryPathHint;

  const searchEntityHints = Array.isArray(readPlan.searchEntityHints)
    ? readPlan.searchEntityHints
    : [];

  const entityFiltered = searchEntityHints
    .map((item) => safeString(item))
    .filter(Boolean)
    .filter((item) => item.length >= 2);

  if (entityFiltered.length > 0) {
    return entityFiltered[0];
  }

  if (readPlan.hasPillarsRootSignal === true) {
    return "pillars/";
  }

  return "";
}

function resolveFileArg(readPlan = {}) {
  const canonicalPillarPath = resolveCanonicalPillarPath(readPlan);
  if (canonicalPillarPath) return canonicalPillarPath;

  const targetPath = safeString(readPlan.targetPath);
  if (targetPath) return targetPath;

  return safeString(readPlan.primaryPathHint);
}

function resolveAnalyzeArg(readPlan = {}) {
  // IMPORTANT:
  // current /repo_analyze handler expects PATH first, optional question after it
  const canonicalPillarPath = resolveCanonicalPillarPath(readPlan);
  const targetPath = canonicalPillarPath || safeString(readPlan.targetPath) || safeString(readPlan.primaryPathHint);
  const question = safeString(readPlan.analyzeQuestion);

  if (!targetPath) return "";
  if (!question) return targetPath;

  return `${targetPath} ${question}`;
}

function resolveWorkflowArg(readPlan = {}) {
  void readPlan;
  return "";
}

function resolveDiffArg(_readPlan = {}) {
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
  const canonicalPillarPath = resolveCanonicalPillarPath(readPlan);
  const needsClarification = readPlan?.needsClarification === true;

  let handlerKey = "repoSearch";
  let recommendedCommand = "/repo_search";
  let commandArg = "";
  let confidence = safeString(readPlan?.confidence) || "low";
  let basis = [];

  if (planKey === "workflow_check") {
    handlerKey = "workflowCheck";
    recommendedCommand = "/workflow_check";
    commandArg = resolveWorkflowArg(readPlan);
    basis = ["workflow_check_bridge", "semantic_intent"];
    if (!commandArg) {
      basis.push("missing_workflow_step");
    }
  } else if (planKey === "stage_check") {
    handlerKey = "stageCheck";
    recommendedCommand = "/stage_check";
    basis = ["stage_check_bridge", "semantic_intent"];
  } else if (planKey === "repo_status") {
    handlerKey = "repoStatus";
    recommendedCommand = "/repo_status";
    basis = ["repo_status_bridge", "semantic_intent"];
  } else if (planKey === "repo_tree") {
    handlerKey = "repoTree";
    recommendedCommand = "/repo_tree";
    basis = ["repo_tree_bridge", "semantic_intent"];
  } else if (planKey === "repo_file") {
    handlerKey = "repoFile";
    recommendedCommand = "/repo_file";
    commandArg = resolveFileArg(readPlan);
    basis = ["repo_file_bridge", "semantic_target_path"];
    if (canonicalPillarPath) basis.push("canonical_pillar_path");
    if (!commandArg) {
      confidence = "low";
      basis.push("missing_path_hint");
    }
  } else if (planKey === "repo_diff") {
    handlerKey = "repoDiff";
    recommendedCommand = "/repo_diff";
    commandArg = resolveDiffArg(readPlan);
    basis = ["repo_diff_bridge", "semantic_intent"];
    if (!commandArg) {
      basis.push("missing_diff_target");
    }
  } else if (planKey === "repo_analyze") {
    handlerKey = "repoAnalyze";
    recommendedCommand = "/repo_analyze";
    commandArg = resolveAnalyzeArg(readPlan);
    basis = ["repo_analyze_bridge", "semantic_target_path"];
    if (canonicalPillarPath) basis.push("canonical_pillar_path");
    if (safeString(readPlan?.analyzeQuestion)) basis.push("analyze_question_attached");
    if (!commandArg) {
      confidence = "low";
      basis.push("missing_analyze_path");
    }
  } else if (planKey === "repo_search") {
    handlerKey = "repoSearch";
    recommendedCommand = "/repo_search";
    commandArg = resolveSearchArg(readPlan);
    basis = ["repo_search_bridge", "semantic_target_entity"];
    if (canonicalPillarPath) basis.push("canonical_pillar_path");
    if (readPlan?.hasPillarsRootSignal === true && !canonicalPillarPath) {
      basis.push("pillars_root_scope");
    }
    if (!commandArg) {
      confidence = "low";
      basis.push("missing_search_arg");
    }
  } else {
    handlerKey = "repoSearch";
    recommendedCommand = "/repo_search";
    commandArg = resolveSearchArg(readPlan);
    basis = ["generic_internal_repo_bridge", "semantic_fallback"];
    if (canonicalPillarPath) basis.push("canonical_pillar_path");
    if (!commandArg) {
      confidence = "low";
      basis.push("missing_generic_search_arg");
    }
  }

  if (needsClarification) {
    confidence = "low";
    basis.push("clarification_required");
  }

  const normalizedArg = quoteIfNeeded(commandArg);
  const commandText = buildCommandText(recommendedCommand, normalizedArg);

  const canAutoExecute =
    routeAllowsInternalRead &&
    !needsClarification &&
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

    canonicalPillarPath,
    needsClarification,
    clarificationQuestion: safeString(readPlan?.clarificationQuestion),

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