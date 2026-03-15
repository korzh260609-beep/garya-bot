// src/core/behaviorCore.js
// ============================================================================
// STAGE 9.6 / 9.7 / 9.8 — BehaviorCore V1 + Style Axis + Soft Style Ask skeleton
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

// ============================================================================
// STAGE 9.7 — STYLE AXIS SKELETON
// IMPORTANT:
// - this is prompt-policy only
// - no DB
// - no ENV
// - no runtime branching outside prompt generation
// - does NOT change answer length
// ============================================================================

function getStyleAxisPolicy(styleAxis) {
  const axis = clampStyleAxis(styleAxis);

  if (axis === "tech") {
    return {
      axis: "tech",
      label: "technical",
      promptLines: [
        "- prioritize structure, precision and implementation details",
        "- use engineering language when useful",
        "- focus on logic, architecture, failure points and concrete actions",
        "- avoid decorative phrasing and emotional padding",
      ],
    };
  }

  if (axis === "humanitarian") {
    return {
      axis: "humanitarian",
      label: "humanitarian",
      promptLines: [
        "- prioritize clarity, empathy and human understanding",
        "- explain in simpler words before using technical density",
        "- keep the answer soft in tone but still honest and critical",
        "- focus on meaning, risks for people and practical understanding",
      ],
    };
  }

  return {
    axis: "mixed",
    label: "mixed",
    promptLines: [
      "- balance technical precision with simple human-readable explanation",
      "- keep the answer understandable first, but not shallow",
      "- combine structure, logic and practical clarity",
      "- use technical terms only where they improve accuracy",
    ],
  };
}

// ============================================================================
// STAGE 9.8 — SOFT STYLE ASK SKELETON
// IMPORTANT:
// - soft detection only
// - explicit styleAxis input always wins
// - no persistent user preference yet
// - no DB / no settings / no command layer
// ============================================================================

function detectSoftStyleAxisFromText(text) {
  const t = String(text || "").trim().toLowerCase();
  if (!t) {
    return {
      styleAxis: "mixed",
      source: "default",
      softAskDetected: false,
    };
  }

  const techSignals = [
    "технически",
    "технично",
    "technical",
    "technically",
    "по архитектуре",
    "архитектурно",
    "с точки зрения кода",
    "по коду",
    "для разработчика",
    "engineering",
    "implementation details",
  ];

  for (const signal of techSignals) {
    if (t.includes(signal)) {
      return {
        styleAxis: "tech",
        source: "soft_ask_from_text",
        softAskDetected: true,
      };
    }
  }

  const humanitarianSignals = [
    "простыми словами",
    "по простому",
    "объясни просто",
    "объясни как ребенку",
    "без сложных слов",
    "мягче",
    "humanly",
    "human",
    "simple words",
    "for a child",
    "easy words",
  ];

  for (const signal of humanitarianSignals) {
    if (t.includes(signal)) {
      return {
        styleAxis: "humanitarian",
        source: "soft_ask_from_text",
        softAskDetected: true,
      };
    }
  }

  const mixedSignals = [
    "и просто и точно",
    "просто но точно",
    "сбалансировано",
    "balanced",
    "mixed",
    "и технически и понятно",
  ];

  for (const signal of mixedSignals) {
    if (t.includes(signal)) {
      return {
        styleAxis: "mixed",
        source: "soft_ask_from_text",
        softAskDetected: true,
      };
    }
  }

  return {
    styleAxis: "mixed",
    source: "default",
    softAskDetected: false,
  };
}

function resolveStyleAxis(input = {}) {
  const requestedStyleAxis = input?.styleAxis || null;
  const text = String(input?.text || "");

  if (requestedStyleAxis) {
    return {
      styleAxis: clampStyleAxis(requestedStyleAxis),
      source: "explicit_input",
      softAskDetected: false,
    };
  }

  return detectSoftStyleAxisFromText(text);
}

export function getBehaviorCore(input = {}) {
  const text = String(input?.text || "");
  const requestedCriticality = input?.criticality || null;

  const styleAxisResolution = resolveStyleAxis(input);
  const styleAxis = styleAxisResolution.styleAxis;

  const criticality = clampCriticality(
    requestedCriticality || detectCriticalityFromText(text)
  );

  const stylePolicy = getStyleAxisPolicy(styleAxis);

  return {
    version: "9.8-skeleton-v1",

    // Stage 9.7 skeleton
    styleAxis,
    styleAxisLabel: stylePolicy.label,
    styleAxisPromptLines: stylePolicy.promptLines,

    // Stage 9.8 skeleton
    styleAxisSource: styleAxisResolution.source,
    softStyleAskDetected: Boolean(styleAxisResolution.softAskDetected),

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
    supportsSoftStyleAsk: true,
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
    `- style_axis_label: ${core.styleAxisLabel}`,
    `- style_axis_source: ${core.styleAxisSource}`,
    `- soft_style_ask_detected: ${core.softStyleAskDetected ? "true" : "false"}`,
    `- criticality: ${core.criticality}`,
    `- no_nodding: ${core.noNodding ? "true" : "false"}`,
    `- max_soft_clarifying_questions: ${core.maxSoftClarifyingQuestions}`,
    "- behavior_independent_from_answer_mode: true",
    "",
    "STYLE AXIS RULES:",
    ...core.styleAxisPromptLines,
    "",
    "RULES:",
    "- do not agree automatically just to sound supportive",
    "- first check for risks, contradictions, weak points and hidden assumptions",
    "- soft form, hard essence",
    "- if intent is unclear, ask at most one soft clarifying question",
    "- answer length must NOT define behavior style",
    "- explicit style axis input has priority over soft style detection",
    "- soft style detection is temporary and must not be treated as saved user preference",
  ].join("\n");
}

export default {
  getBehaviorCore,
  buildBehaviorCorePromptBlock,
};