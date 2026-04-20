// src/core/projectIntent/readPlan/projectIntentReadPlanOutput.js

export function resolvePlanPreview({ planKey } = {}) {
  const key = String(planKey || "").trim();

  if (key === "workflow_check") return "workflow/state reading path";
  if (key === "stage_check") return "stage reading path";
  if (key === "repo_status") return "repo status reading path";
  if (key === "repo_tree") return "repo tree reading path";
  if (key === "repo_file") return "repo file reading path";
  if (key === "repo_search") return "repo search reading path";
  if (key === "repo_analyze") return "repo analysis reading path";
  if (key === "repo_diff") return "repo diff reading path";

  return "generic internal read path";
}

export function resolveNeedsClarification({
  planKey,
  targetEntity,
  targetPath,
}) {
  if (planKey === "repo_status") {
    return { needsClarification: false, clarificationQuestion: "" };
  }

  if (planKey === "workflow_check") {
    return { needsClarification: false, clarificationQuestion: "" };
  }

  if (planKey === "stage_check" && !targetEntity && !targetPath) {
    return {
      needsClarification: true,
      clarificationQuestion: "Какой именно stage нужно проверить?",
    };
  }

  if (planKey === "repo_file" && !targetPath) {
    return {
      needsClarification: true,
      clarificationQuestion: "Какой именно файл или документ открыть?",
    };
  }

  if (planKey === "repo_search" && !targetEntity && !targetPath) {
    return {
      needsClarification: true,
      clarificationQuestion: "Что именно искать в репозитории?",
    };
  }

  if (planKey === "repo_analyze" && !targetPath) {
    return {
      needsClarification: true,
      clarificationQuestion: "Что именно нужно объяснить или перевести?",
    };
  }

  return { needsClarification: false, clarificationQuestion: "" };
}

export function resolveConfidence({
  hasRepoAccessMetaSignal,
  targetKind,
  targetPath,
  targetEntity,
  intentType,
  needsClarification,
  followupContext = null,
}) {
  if (needsClarification) return "low";
  if (hasRepoAccessMetaSignal) return "high";
  if (followupContext?.isActive && targetPath) return "high";
  if (targetKind === "canonical_doc" && targetPath) return "high";
  if (targetKind === "path" && targetPath) return "high";
  if (intentType === "find_target" && targetEntity) return "medium";
  if (intentType === "open_target" && targetPath) return "high";
  if (intentType === "explain_target" && (targetPath || targetEntity)) return "high";
  if (targetEntity) return "medium";
  return "low";
}

export function resolveAnalyzeQuestion({ text, planKey }) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  if (planKey !== "repo_analyze") return "";
  return raw;
}

export default {
  resolvePlanPreview,
  resolveNeedsClarification,
  resolveConfidence,
  resolveAnalyzeQuestion,
};