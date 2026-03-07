export const DECISION_JUDGES = {
  default: async function defaultJudge(workerResult, context) {
    void context;

    return {
      ok: true,
      approved: true,
      finalText: workerResult?.draft || null,
      warnings: ["judge_default_used"],
      reason: "judge_default",
    };
  },

  none: async function noneJudge(workerResult, context) {
    void context;

    return {
      ok: true,
      approved: true,
      finalText: workerResult?.draft || null,
      warnings: ["judge_none_selected"],
      reason: "judge_none",
    };
  },

  chat_simple: async function chatSimpleJudge(workerResult, context) {
    void context;

    return {
      ok: true,
      approved: true,
      finalText: workerResult?.draft || null,
      warnings: ["judge_chat_simple_not_implemented"],
      reason: "judge_chat_simple",
    };
  },

  chat_complex: async function chatComplexJudge(workerResult, context) {
    void context;

    return {
      ok: true,
      approved: true,
      finalText: workerResult?.draft || null,
      warnings: ["judge_chat_complex_not_implemented"],
      reason: "judge_chat_complex",
    };
  },

  repo_analysis: async function repoAnalysisJudge(workerResult, context) {
    void context;

    return {
      ok: true,
      approved: true,
      finalText: workerResult?.draft || null,
      warnings: ["judge_repo_analysis_not_implemented"],
      reason: "judge_repo_analysis",
    };
  },

  system_diag: async function systemDiagJudge(workerResult, context) {
    void context;

    return {
      ok: true,
      approved: true,
      finalText: workerResult?.draft || null,
      warnings: ["judge_system_diag_not_implemented"],
      reason: "judge_system_diag",
    };
  },
};