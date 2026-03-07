/**
 * Decision Planner Replay Set
 *
 * Responsibility:
 * - provides stable sandbox input set for Decision Planner
 * - helps compare planner behavior across future iterations
 *
 * IMPORTANT:
 * - sandbox only
 * - NOT connected to production pipeline
 * - no side effects
 */

export const DECISION_PLANNER_REPLAY_SET = [
  {
    id: "planner_repo_analysis",
    title: "Repository analysis goal",
    input: {
      goal: "analyze github repository structure and propose next step",
    },
    expected: {
      kind: "repo_analysis",
      workerType: "repo_analysis",
      requiresJudge: true,
      requiresAI: false,
    },
  },

  {
    id: "planner_source_query",
    title: "Source query goal",
    input: {
      goal: "check coin market price and coingecko source",
    },
    expected: {
      kind: "source_query",
      workerType: "source_query",
      requiresJudge: false,
      requiresAI: false,
    },
  },

  {
    id: "planner_task_execution",
    title: "Task execution goal",
    input: {
      goal: "/run diagnostics",
    },
    expected: {
      kind: "task_execution",
      workerType: "command",
      requiresJudge: false,
      requiresAI: false,
    },
  },

  {
    id: "planner_chat_simple",
    title: "Simple chat goal",
    input: {
      goal: "hello advisor",
    },
    expected: {
      kind: "chat_simple",
      workerType: "chat",
      requiresJudge: false,
      requiresAI: false,
    },
  },

  {
    id: "planner_chat_complex",
    title: "Complex chat goal",
    input: {
      goal:
        "please analyze this long multi-step request and explain how the system should behave in several cases while keeping the production pipeline untouched and preserving architectural isolation between transport core handlers services and sandbox reasoning modules for future controlled routing",
    },
    expected: {
      kind: "chat_complex",
      workerType: "chat",
      requiresJudge: true,
      requiresAI: true,
    },
  },

  {
    id: "planner_empty_goal",
    title: "Empty goal",
    input: {
      goal: "",
    },
    expected: {
      kind: "unknown",
      workerType: "none",
      requiresJudge: false,
      requiresAI: false,
    },
  },
];