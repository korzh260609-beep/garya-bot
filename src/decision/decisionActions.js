export const DECISION_ACTIONS = {
  none: async function noneAction(context = {}) {
    void context;

    return {
      ok: true,
      facts: [],
      draft: null,
      warnings: ["action_none_selected"],
    };
  },

  basic: async function basicAction(context = {}) {
    return {
      ok: true,
      facts: [],
      draft: context?.text || null,
      warnings: ["action_basic_not_implemented"],
    };
  },

  command: async function commandAction(context = {}) {
    return {
      ok: true,
      facts: [
        {
          type: "command",
          value: context?.command || null,
        },
      ],
      draft: null,
      warnings: ["action_command_not_implemented"],
    };
  },

  source_query: async function sourceQueryAction(context = {}) {
    return {
      ok: true,
      facts: [
        {
          type: "source_query",
          value: context?.text || context?.command || null,
        },
      ],
      draft: null,
      warnings: ["action_source_query_not_implemented"],
    };
  },

  repo_analysis: async function repoAnalysisAction(context = {}) {
    return {
      ok: true,
      facts: [
        {
          type: "repo_analysis",
          value: context?.text || context?.command || null,
        },
      ],
      draft: null,
      warnings: ["action_repo_analysis_not_implemented"],
    };
  },

  system_diag: async function systemDiagAction(context = {}) {
    return {
      ok: true,
      facts: [
        {
          type: "system_diag",
          value: context?.text || context?.command || null,
        },
      ],
      draft: null,
      warnings: ["action_system_diag_not_implemented"],
    };
  },

  chat: async function chatAction(context = {}) {
    return {
      ok: true,
      facts: [
        {
          type: "chat",
          value: context?.text || null,
        },
      ],
      draft: context?.text || null,
      warnings: ["action_chat_not_implemented"],
    };
  },
};