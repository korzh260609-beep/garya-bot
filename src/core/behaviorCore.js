// src/core/behaviorCore.js
// ============================================================================
// STAGE 9.6 / 9.7 / 9.8 / 9.9 / 9.10 — BehaviorCore V1 + Style Axis +
// Soft Style Ask + Criticality V1 + No-Nodding hard rule
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
//
// ADDITIONAL HARD RULE:
// - do NOT derive behavior from keyword / phrase lists
// - do NOT pretend semantic understanding from surface words
// - if no explicit signal is provided, use safe defaults

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

// ============================================================================
// STAGE 9.9 — CRITICALITY V1 SKELETON
// IMPORTANT:
// - criticality is behavior pressure, not answer length
// - high criticality may increase strictness of analysis
// - but must NOT silently become a different personality
// - explicit input wins over defaults
// - NO keyword / phrase based criticality detection here
// ============================================================================

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
        "- keep analysis light only when the topic is truly low-risk",
        "- do not create artificial alarm where it is unnecessary",
        "- still remain honest and critical even in simple topics",
        "- prefer calm proportional reasoning over dramatic warnings",
      ],
    };
  }

  if (level === "high") {
    return {
      level: "high",
      promptLines: [
        "- start from risks, failure modes, contradictions and hidden assumptions",
        "- warn explicitly if the idea may cause loss, breakage, unsafe behavior or false confidence",
        "- be stricter than usual when safety, law, money, medicine, production or architecture is involved",
        "- do not soften away important weaknesses just to sound pleasant",
        "- when needed, separate critical blockers from secondary notes",
      ],
    };
  }

  return {
    level: "normal",
    promptLines: [
      "- keep balanced critical analysis",
      "- point out important risks, but stay proportional",
      "- preserve practical clarity without over-dramatizing",
      "- prefer useful critique over abstract caution",
    ],
  };
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
        "- prefer structured, engineering-style explanation",
        "- focus on mechanism, causality, constraints, edge cases and implementation details",
        "- use precise technical terms when they improve accuracy",
        "- reduce everyday analogies and emotional softeners unless they are necessary",
        "- when possible, explain in terms of system, inputs, outputs, failure points and trade-offs",
        "- prefer exact wording over conversational softness",
      ],
    };
  }

  if (axis === "humanitarian") {
    return {
      axis: "humanitarian",
      label: "humanitarian",
      promptLines: [
        "- explain in simple human words first",
        "- prefer shorter sentences and clearer wording",
        "- reduce technical density unless it is necessary for accuracy",
        "- prioritize intuitive meaning, practical understanding and readability",
        "- use examples from everyday life when they help",
        "- sound understandable to a child, but do not become false or shallow",
      ],
    };
  }

  return {
    axis: "mixed",
    label: "mixed",
    promptLines: [
      "- balance precision with readability",
      "- explain clearly, but keep meaningful technical accuracy",
      "- combine practical explanation with core mechanism",
      "- use technical terms only where they truly add value",
      "- avoid both oversimplification and unnecessary complexity",
    ],
  };
}

// ============================================================================
// STAGE 9.8 — SOFT STYLE ASK SKELETON
// IMPORTANT:
// - explicit styleAxis input always wins
// - no persistent user preference yet
// - no DB / no settings / no command layer
// - NO keyword / phrase based soft-style detection here
// ============================================================================

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

// ============================================================================
// STAGE 9.10 — NO-NODDING HARD RULE
// IMPORTANT:
// - this is a hard behavior rule
// - must not turn the assistant rude
// - must prevent fake agreement, flattery-agreement and empty validation
// - still allows polite tone and accurate partial agreement
// ============================================================================

function getNoNoddingPolicy() {
  return {
    enabled: true,
    promptLines: [
      "- never start by mirroring the user's confidence as if it proves correctness",
      "- do not praise, romanticize or positively frame an idea before checking whether it is actually sound",
      "- avoid empty phrases like 'great idea', 'sounds inspiring', 'exactly right' or similar approval unless they are justified by analysis",
      "- when the idea is only partly useful, say clearly which part works and which part fails",
      "- if the core conclusion is wrong, say so politely but directly in the first evaluative sentence",
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
    version: "9.10-skeleton-v4",

    // Stage 9.7 skeleton
    styleAxis,
    styleAxisLabel: stylePolicy.label,
    styleAxisPromptLines: stylePolicy.promptLines,

    // Stage 9.8 skeleton
    styleAxisSource: styleAxisResolution.source,
    softStyleAskDetected: Boolean(styleAxisResolution.softAskDetected),

    // Stage 9.9 skeleton
    criticality,
    criticalitySource: criticalityResolution.source,
    criticalityPromptLines: criticalityPolicy.promptLines,

    // Stage 9.10 hard rule
    noNodding: true,
    noNoddingPromptLines: noNoddingPolicy.promptLines,

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
    `- criticality_source: ${core.criticalitySource}`,
    `- no_nodding: ${core.noNodding ? "true" : "false"}`,
    `- max_soft_clarifying_questions: ${core.maxSoftClarifyingQuestions}`,
    "- behavior_independent_from_answer_mode: true",
    "",
    "STYLE AXIS RULES:",
    ...core.styleAxisPromptLines,
    "",
    "CRITICALITY RULES:",
    ...core.criticalityPromptLines,
    "",
    "NO-NODDING RULES:",
    ...core.noNoddingPromptLines,
    "",
    "RULES:",
    "- do not agree automatically just to sound supportive",
    "- first check for risks, contradictions, weak points and hidden assumptions",
    "- soft form, hard essence",
    "- if intent is unclear, ask at most one soft clarifying question",
    "- answer length must NOT define behavior style",
    "- explicit style axis input has priority over defaults",
    "- explicit criticality input has priority over defaults",
    "- no keyword or phrase lists may be treated as true understanding of user intent",
    "- if there is no explicit behavior signal, use safe defaults instead of pretending semantic certainty",
    "- criticality affects strictness of analysis, not answer length and not core personality",
    "- no-nodding forbids blind agreement, but does not forbid polite and precise partial agreement",
  ].join("\n");
}

export default {
  getBehaviorCore,
  buildBehaviorCorePromptBlock,
};