export const DECISION_WORKERS = {
  none: async function noneWorker(route, context) {
    void route;
    void context;

    return {
      ok: true,
      facts: [],
      draft: null,
      warnings: ["worker_none_selected"],
    };
  },

  basic: async function basicWorker(route, context) {
    void route;

    return {
      ok: true,
      facts: [],
      draft: context?.text || null,
      warnings: ["worker_basic_not_implemented"],
    };
  },

  command: async function commandWorker(route, context) {
    return {
      ok: true,
      facts: [
        {
          type: "command",
          value: context?.command || null,
        },
      ],
      draft: null,
      warnings: ["worker_command_not_implemented"],
    };
  },

  source_query: async function sourceQueryWorker(route, context) {
    void route;

    return {
      ok: true,
      facts: [
        {
          type: "source_query",
          value: context?.text || context?.command || null,
        },
      ],
      draft: null,
      warnings: ["worker_source_query_not_implemented"],
    };
  },

  repo_analysis: async function repoAnalysisWorker(route, context) {
    void route;

    return {
      ok: true,
      facts: [
        {
          type: "repo_analysis",
          value: context?.text || context?.command || null,
        },
      ],
      draft: null,
      warnings: ["worker_repo_analysis_not_implemented"],
    };
  },

  system_diag: async function systemDiagWorker(route, context) {
    void route;

    return {
      ok: true,
      facts: [
        {
          type: "system_diag",
          value: context?.text || context?.command || null,
        },
      ],
      draft: null,
      warnings: ["worker_system_diag_not_implemented"],
    };
  },

  chat: async function chatWorker(route, context) {
    void route;

    return {
      ok: true,
      facts: [
        {
          type: "chat",
          value: context?.text || null,
        },
      ],
      draft: context?.text || null,
      warnings: ["worker_chat_not_implemented"],
    };
  },
};