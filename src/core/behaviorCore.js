// src/core/behaviorCore.js

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

function resolveCriticality(input = {}) {
  const requestedCriticality = input?.criticality || null;

  if (requestedCriticality) {
    return {
      criticality: clampCriticality(requestedCriticality),
      source: "explicit_input",
    };
  }

  return {
    criticality: "normal",
    source: "default_no_text_detection",
  };
}

function getCriticalityPolicy(criticality) {
  const level = clampCriticality(criticality);

  if (level === "low") {
    return {
      level: "low",
      promptLines: [
        "- keep analysis proportional",
        "- do not create artificial alarm",
        "- stay honest and critical even in simple topics",
      ],
    };
  }

  if (level === "high") {
    return {
      level: "high",
      promptLines: [
        "- start from risks, contradictions and failure points",
        "- warn clearly about unsafe, costly or false-confidence paths",
        "- separate critical blockers from secondary notes when needed",
      ],
    };
  }

  return {
    level: "normal",
    promptLines: [
      "- keep balanced critical analysis",
      "- point out important risks without dramatizing",
      "- prefer practical critique over abstract caution",
    ],
  };
}

function getStyleAxisPolicy(styleAxis) {
  const axis = clampStyleAxis(styleAxis);

  if (axis === "tech") {
    return {
      axis: "tech",
      label: "technical",
      promptLines: [
        "- prefer structured engineering-style explanation",
        "- focus on mechanism, constraints, edge cases and trade-offs",
        "- use precise technical terms only when they improve accuracy",
      ],
    };
  }

  if (axis === "humanitarian") {
    return {
      axis: "humanitarian",
      label: "humanitarian",
      promptLines: [
        "- explain in simple human words first",
        "- prefer clarity and readability over technical density",
        "- use everyday examples only when they help understanding",
      ],
    };
  }

  return {
    axis: "mixed",
    label: "mixed",
    promptLines: [
      "- balance precision with readability",
      "- explain clearly without oversimplifying",
      "- use technical terms only where they add value",
    ],
  };
}

function resolveStyleAxis(input = {}) {
  const requestedStyleAxis = input?.styleAxis || null;

  if (requestedStyleAxis) {
    return {
      styleAxis: clampStyleAxis(requestedStyleAxis),
      source: "explicit_input",
      softAskDetected: false,
    };
  }

  return {
    styleAxis: "mixed",
    source: "default_no_text_detection",
    softAskDetected: false,
  };
}

function getNoNoddingPolicy() {
  return {
    enabled: true,
    promptLines: [
      "- do not validate ideas before checking them",
      "- avoid empty praise or fake agreement",
      "- if an idea is partly right, say what works and what fails",
      "- politeness is allowed, blind validation is forbidden",
    ],
  };
}

export function getBehaviorCore(input = {}) {
  const styleAxisResolution = resolveStyleAxis(input);
  const styleAxis = styleAxisResolution.styleAxis;

  const criticalityResolution = resolveCriticality(input);
  const criticality = criticalityResolution.criticality;

  const stylePolicy = getStyleAxisPolicy(styleAxis);
  const criticalityPolicy = getCriticalityPolicy(criticality);
  const noNoddingPolicy = getNoNoddingPolicy();

  return {
    version: "9.10-skeleton-v5-compact",

    styleAxis,
    styleAxisLabel: stylePolicy.label,
    styleAxisPromptLines: stylePolicy.promptLines,

    styleAxisSource: styleAxisResolution.source,
    softStyleAskDetected: Boolean(styleAxisResolution.softAskDetected),

    criticality,
    criticalitySource: criticalityResolution.source,
    criticalityPromptLines: criticalityPolicy.promptLines,

    noNodding: true,
    noNoddingPromptLines: noNoddingPolicy.promptLines,

    maxSoftClarifyingQuestions: 1,
    behaviorIndependentFromAnswerMode: true,

    supportsStyleAxis: true,
    supportsSoftStyleAsk: true,
    supportsCriticality: true,
    supportsNoNodding: true,
  };
}

export function buildBehaviorCorePromptBlock(coreInput = {}) {
  const core = getBehaviorCore(coreInput);

  return [
    "BEHAVIOR CORE:",
    `- version: ${core.version}`,
    `- style_axis: ${core.styleAxis}`,
    `- style_axis_source: ${core.styleAxisSource}`,
    `- criticality: ${core.criticality}`,
    `- criticality_source: ${core.criticalitySource}`,
    `- no_nodding: ${core.noNodding ? "true" : "false"}`,
    `- max_soft_clarifying_questions: ${core.maxSoftClarifyingQuestions}`,
    "",
    "STYLE:",
    ...core.styleAxisPromptLines,
    "",
    "CRITICALITY:",
    ...core.criticalityPromptLines,
    "",
    "NO-NODDING:",
    ...core.noNoddingPromptLines,
    "",
    "CORE RULES:",
    "- do not auto-agree just to sound supportive",
    "- check risks, contradictions and weak points before approval",
    "- if intent is unclear, ask at most one soft clarifying question",
    "- answer length must not define behavior style",
    "- explicit style/criticality input has priority",
    "- if there is no explicit signal, use safe defaults",
  ].join("\n");
}

export default {
  getBehaviorCore,
  buildBehaviorCorePromptBlock,
};