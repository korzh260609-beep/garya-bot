// src/core/behaviorCore.js
// ============================================================================
// STAGE 9.6 — BehaviorCore V1
// ============================================================================
//
// CURRENT STATE:
// - BehaviorCore introduced as a separate behavior-policy module
// - prompt wiring is already connected through systemPrompt.js
// - chat handler already passes userText into buildSystemPrompt(...)
// - runtime behavior expansion is still minimal/skeleton-level
//
// PURPOSE:
// - keep behavior-level policy in one place
// - keep BehaviorCore independent from AnswerMode
// - provide a safe foundation for Stage 9.7 / 9.9 / 9.10
//
// IMPORTANT:
// - this module is already wired into prompt generation
// - but it still remains skeleton-level by logic depth
// - future steps may expand:
//   1) style axis behavior
//   2) criticality behavior
//   3) no-nodding enforcement
//   4) behavior events integration
//
// HARD RULE:
// - answer length != behavior style
// - AnswerMode and BehaviorCore must remain separate concerns

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
