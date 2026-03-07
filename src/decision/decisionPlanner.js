/**
 * Decision Planner
 *
 * Responsibility:
 * - converts user goal into structured sandbox plan
 * - does NOT execute actions
 * - does NOT modify production pipeline
 * - does NOT connect into handleMessage
 * - does NOT connect into TelegramAdapter
 *
 * Purpose:
 * goal
 * -> plan steps
 * -> worker selection
 * -> validation
 * -> execution proposal
 */

import { DECISION_KIND } from "./decisionTypes.js";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function detectGoalType(goal = "") {
  const text = goal.toLowerCase();

  if (!text) {
    return DECISION_KIND.UNKNOWN;
  }

  if (
    text.includes("repo") ||
    text.includes("repository") ||
    text.includes("github")
  ) {
    return DECISION_KIND.REPO_ANALYSIS;
  }

  if (
    text.includes("price") ||
    text.includes("coin") ||
    text.includes("market") ||
    text.includes("coingecko")
  ) {
    return DECISION_KIND.SOURCE_QUERY;
  }

  if (
    text.startsWith("/") ||
    text.includes("run command") ||
    text.includes("execute task")
  ) {
    return DECISION_KIND.TASK_EXECUTION;
  }

  if (text.length > 280) {
    return DECISION_KIND.CHAT_COMPLEX;
  }

  return DECISION_KIND.CHAT_SIMPLE;
}

function selectWorkerType(kind) {
  switch (kind) {
    case DECISION_KIND.REPO_ANALYSIS:
      return "repo_analysis";

    case DECISION_KIND.SOURCE_QUERY:
      return "source_query";

    case DECISION_KIND.TASK_EXECUTION:
      return "command";

    case DECISION_KIND.SYSTEM_DIAG:
      return "system_diag";

    case DECISION_KIND.CHAT_COMPLEX:
    case DECISION_KIND.CHAT_SIMPLE:
      return "chat";

    default:
      return "none";
  }
}

function buildPlanSteps(kind, workerType) {
  const steps = [
    {
      id: "step_goal_intake",
      type: "goal_intake",
      status: "planned",
      description: "Normalize incoming goal",
    },
    {
      id: "step_route_selection",
      type: "route_selection",
      status: "planned",
      description: "Select decision kind and worker",
    },
    {
      id: "step_validation",
      type: "validation",
      status: "planned",
      description: "Validate plan before execution",
    },
  ];

  if (workerType !== "none") {
    steps.push({
      id: "step_worker_execution",
      type: "worker_execution",
      status: "proposed",
      description: `Propose sandbox worker execution: ${workerType}`,
    });
  }

  if (
    kind === DECISION_KIND.CHAT_COMPLEX ||
    kind === DECISION_KIND.REPO_ANALYSIS
  ) {
    steps.push({
      id: "step_judge_review",
      type: "judge_review",
      status: "proposed",
      description: "Propose judge review after worker result",
    });
  }

  return steps;
}

function validatePlan(goal, kind, workerType, steps) {
  const warnings = [];

  if (!goal) {
    warnings.push("planner_goal_empty");
  }

  if (kind === DECISION_KIND.UNKNOWN) {
    warnings.push("planner_kind_unknown");
  }

  if (workerType === "none") {
    warnings.push("planner_worker_not_selected");
  }

  if (!Array.isArray(steps) || steps.length === 0) {
    warnings.push("planner_steps_empty");
  }

  return {
    ok: warnings.length === 0,
    warnings,
  };
}

function buildExecutionProposal({ goal, kind, workerType, validation }) {
  return {
    allowed: Boolean(goal) && workerType !== "none",
    mode: "sandbox_only",
    kind,
    workerType,
    requiresJudge:
      kind === DECISION_KIND.CHAT_COMPLEX ||
      kind === DECISION_KIND.REPO_ANALYSIS,
    requiresAI: kind === DECISION_KIND.CHAT_COMPLEX,
    blockedBy: validation.ok ? [] : [...validation.warnings],
  };
}

export function createDecisionPlan(data = {}) {
  return {
    ok: data.ok ?? false,
    goal: data.goal || null,
    normalizedGoal: data.normalizedGoal || null,
    kind: data.kind || DECISION_KIND.UNKNOWN,
    workerType: data.workerType || "none",
    steps: Array.isArray(data.steps) ? data.steps : [],
    validation: data.validation || {
      ok: false,
      warnings: ["planner_validation_missing"],
    },
    executionProposal: data.executionProposal || {
      allowed: false,
      mode: "sandbox_only",
      kind: DECISION_KIND.UNKNOWN,
      workerType: "none",
      requiresJudge: false,
      requiresAI: false,
      blockedBy: ["planner_execution_proposal_missing"],
    },
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  };
}

export async function planDecision(input = {}) {
  const goal = normalizeText(input.goal || input.text || input.command || "");
  const kind = detectGoalType(goal);
  const workerType = selectWorkerType(kind);
  const steps = buildPlanSteps(kind, workerType);
  const validation = validatePlan(goal, kind, workerType, steps);
  const executionProposal = buildExecutionProposal({
    goal,
    kind,
    workerType,
    validation,
  });

  const warnings = [...validation.warnings];

  return createDecisionPlan({
    ok: validation.ok,
    goal: input.goal || input.text || input.command || null,
    normalizedGoal: goal || null,
    kind,
    workerType,
    steps,
    validation,
    executionProposal,
    warnings,
  });
}