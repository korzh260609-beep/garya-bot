// src/core/behaviorCore.js
// ============================================================================
// STAGE 9.6 — BehaviorCore V1 (SKELETON ONLY)
// ============================================================================
//
// PURPOSE:
// - introduce a single place for behavior-level policy
// - keep BehaviorCore independent from AnswerMode
// - do NOT change runtime behavior yet
// - do NOT wire this into prompt/router in this step
//
// THIS FILE IS SKELETON ONLY.
// Real integration into systemPrompt / chat handler must be a separate step.

export const BEHAVIOR_STYLE_AXES = ["tech", "humanitarian", "mixed"];
export const BEHAVIOR_CRITICALITY_LEVELS = ["low", "normal", "high"];

function clampStyleAxis(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "tech") return "tech";
  if (v === "humanitarian") return "humanitarian";
  return "mixed";
}

function clampCriticality(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "low") return "low";
  if (v === "high") return "high";
  return "normal";
}

function detectCriticalityFromText(text) {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return "normal";

  const highSignals = [
    "ошибка",
    "error",
    "bug",
    "security",
    "безопас",
    "небезопас",
    "уязв",
    "взлом",
    "hack",
    "law",
    "legal",
    "юрид",
    "медиц",
    "medical",
    "финанс",
    "financial",
    "деньги",
    "потер",
    "risk",
    "риск",
    "опас",
    "архитект",
    "архітект",
    "prod",
    "production",
    "deploy",
    "render",
    "github",
    "repo",
    "workflow",
    "roadmap",
  ];

  for (const signal of highSignals) {
    if (t.includes(signal)) return "high";
  }

  const lowSignals = [
    "привет",
    "hello",
    "как дела",
    "шутк",
    "мем",
    "smile",
  ];

  for (const signal of lowSignals) {
    if (t.includes(signal)) return "low";
  }

  return "normal";
}

export function getBehaviorCore(input = {}) {
  const text = String(input?.text || "");
  const requestedStyleAxis = input?.styleAxis || null;
  const requestedCriticality = input?.criticality || null;

  const styleAxis = clampStyleAxis(requestedStyleAxis || "mixed");
  const criticality = clampCriticality(
    requestedCriticality || detectCriticalityFromText(text)
  );

  return {
    version: "9.6-skeleton-v1",

    // Stage 9.7 skeleton
    styleAxis,

    // Stage 9.9 skeleton
    criticality,

    // Stage 9.10 hard rule
    noNodding: true,

    // workflow 1.1 rule
    maxSoftClarifyingQuestions: 1,

    // explicit reminder: behavior != answer length
    behaviorIndependentFromAnswerMode: true,

    // skeleton flags for future expansion
    supportsStyleAxis: true,
    supportsCriticality: true,
    supportsNoNodding: true,
  };
}

export function buildBehaviorCorePromptBlock(coreInput = {}) {
  const core = getBehaviorCore(coreInput);

  return [
    "BEHAVIOR CORE V1:",
    `- version: ${core.version}`,
    `- style_axis: ${core.styleAxis}`,
    `- criticality: ${core.criticality}`,
    `- no_nodding: ${core.noNodding ? "true" : "false"}`,
    `- max_soft_clarifying_questions: ${core.maxSoftClarifyingQuestions}`,
    "- behavior_independent_from_answer_mode: true",
    "",
    "RULES:",
    "- do not agree automatically just to sound supportive",
    "- first check for risks, contradictions, weak points and hidden assumptions",
    "- soft form, hard essence",
    "- if intent is unclear, ask at most one soft clarifying question",
    "- answer length must NOT define behavior style",
  ].join("\n");
}

export default {
  getBehaviorCore,
  buildBehaviorCorePromptBlock,
};