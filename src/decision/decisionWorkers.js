import { DECISION_ACTIONS } from "./decisionActions.js";

async function runAction(actionType, context) {
  const action =
    DECISION_ACTIONS[actionType] || DECISION_ACTIONS.none;

  const actionResult = await action(context);

  return {
    ok: actionResult?.ok ?? true,
    facts: actionResult?.facts || [],
    draft: actionResult?.draft || null,
    warnings: [
      ...(actionType in DECISION_ACTIONS ? [] : ["action_type_not_found"]),
      ...(actionResult?.warnings || []),
    ],
  };
}

export const DECISION_WORKERS = {
  none: async function noneWorker(route, context) {
    void route;
    return runAction("none", context);
  },

  basic: async function basicWorker(route, context) {
    void route;
    return runAction("basic", context);
  },

  command: async function commandWorker(route, context) {
    void route;
    return runAction("command", context);
  },

  source_query: async function sourceQueryWorker(route, context) {
    void route;
    return runAction("source_query", context);
  },

  repo_analysis: async function repoAnalysisWorker(route, context) {
    void route;
    return runAction("repo_analysis", context);
  },

  system_diag: async function systemDiagWorker(route, context) {
    void route;
    return runAction("system_diag", context);
  },

  chat: async function chatWorker(route, context) {
    void route;
    return runAction("chat", context);
  },
};