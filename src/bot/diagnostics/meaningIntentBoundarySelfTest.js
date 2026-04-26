// src/bot/diagnostics/meaningIntentBoundarySelfTest.js
// ============================================================================
// STAGE 7A — Meaning / Intent Boundary self-test helper
// Purpose:
// - test MeaningIntentBoundary behavior in isolation
// - keep runtime behavior unchanged
// - do NOT execute handlers here
// - do NOT parse raw user text here
// - do NOT match keywords or fixed phrases here
// - do NOT connect this diagnostic to normal conversation runtime here
// ============================================================================

import {
  MeaningIntentBoundary,
  MEANING_INTENT_SOURCES,
} from "../../core/meaningIntent/MeaningIntentBoundary.js";

function testCase({ name, boundaryOptions = {}, input, expected }) {
  return { name, boundaryOptions, input, expected };
}

function pickDecision(decision = {}) {
  return {
    accepted: decision.accepted === true,
    reason: decision.reason || null,
    intentKey: decision.intentKey || null,
    source: decision.source || null,
    confidence: typeof decision.confidence === "number" ? decision.confidence : null,
    rawTextUsed: decision.rawTextUsed === true,
    phraseMatching: decision.phraseMatching === true,
  };
}

function matchesExpected(actual = {}, expected = {}) {
  return (
    actual.accepted === expected.accepted &&
    actual.reason === expected.reason &&
    actual.intentKey === expected.intentKey &&
    actual.source === expected.source
  );
}

export function runMeaningIntentBoundarySelfTest() {
  const cases = [
    testCase({
      name: "valid ai structured intent accepted",
      input: {
        intentKey: "project_repo_status",
        source: MEANING_INTENT_SOURCES.AI,
        confidence: 0.85,
        rawTextUsed: false,
        phraseMatching: false,
      },
      expected: {
        accepted: true,
        reason: "accepted_structured_intent",
        intentKey: "project_repo_status",
        source: MEANING_INTENT_SOURCES.AI,
      },
    }),

    testCase({
      name: "valid robot structured intent accepted",
      input: {
        intentKey: "memory_status_check",
        source: MEANING_INTENT_SOURCES.ROBOT,
        confidence: 0.9,
      },
      expected: {
        accepted: true,
        reason: "accepted_structured_intent",
        intentKey: "memory_status_check",
        source: MEANING_INTENT_SOURCES.ROBOT,
      },
    }),

    testCase({
      name: "intent type fallback accepted",
      input: {
        type: "capabilities_list",
        source: MEANING_INTENT_SOURCES.SYSTEM,
        confidence: 0.8,
      },
      expected: {
        accepted: true,
        reason: "accepted_structured_intent",
        intentKey: "capabilities_list",
        source: MEANING_INTENT_SOURCES.SYSTEM,
      },
    }),

    testCase({
      name: "raw text usage rejected",
      input: {
        intentKey: "project_repo_status",
        source: MEANING_INTENT_SOURCES.AI,
        confidence: 0.9,
        rawTextUsed: true,
      },
      expected: {
        accepted: false,
        reason: "raw_text_not_allowed",
        intentKey: "project_repo_status",
        source: MEANING_INTENT_SOURCES.AI,
      },
    }),

    testCase({
      name: "phrase matching rejected",
      input: {
        intentKey: "project_repo_status",
        source: MEANING_INTENT_SOURCES.AI,
        confidence: 0.9,
        phraseMatching: true,
      },
      expected: {
        accepted: false,
        reason: "phrase_or_keyword_matching_not_allowed",
        intentKey: "project_repo_status",
        source: MEANING_INTENT_SOURCES.AI,
      },
    }),

    testCase({
      name: "keyword matching rejected",
      input: {
        intentKey: "project_repo_status",
        source: MEANING_INTENT_SOURCES.AI,
        confidence: 0.9,
        keywordMatching: true,
      },
      expected: {
        accepted: false,
        reason: "phrase_or_keyword_matching_not_allowed",
        intentKey: "project_repo_status",
        source: MEANING_INTENT_SOURCES.AI,
      },
    }),

    testCase({
      name: "missing intent key rejected",
      input: {
        source: MEANING_INTENT_SOURCES.AI,
        confidence: 0.9,
      },
      expected: {
        accepted: false,
        reason: "missing_intent_key",
        intentKey: null,
        source: MEANING_INTENT_SOURCES.AI,
      },
    }),

    testCase({
      name: "invalid source rejected",
      input: {
        intentKey: "project_repo_status",
        source: "unknown_source",
        confidence: 0.9,
      },
      expected: {
        accepted: false,
        reason: "invalid_intent_source",
        intentKey: "project_repo_status",
        source: null,
      },
    }),

    testCase({
      name: "invalid confidence rejected",
      input: {
        intentKey: "project_repo_status",
        source: MEANING_INTENT_SOURCES.AI,
        confidence: "bad",
      },
      expected: {
        accepted: false,
        reason: "invalid_confidence",
        intentKey: "project_repo_status",
        source: MEANING_INTENT_SOURCES.AI,
      },
    }),

    testCase({
      name: "low confidence rejected",
      boundaryOptions: {
        minConfidence: 0.7,
      },
      input: {
        intentKey: "project_repo_status",
        source: MEANING_INTENT_SOURCES.AI,
        confidence: 0.5,
      },
      expected: {
        accepted: false,
        reason: "confidence_below_threshold",
        intentKey: "project_repo_status",
        source: MEANING_INTENT_SOURCES.AI,
      },
    }),
  ];

  const results = cases.map((item) => {
    const boundary = new MeaningIntentBoundary(item.boundaryOptions);
    const decision = boundary.validate(item.input);
    const actual = pickDecision(decision);
    const pass = matchesExpected(actual, item.expected);

    return {
      name: item.name,
      pass,
      expected: item.expected,
      actual,
    };
  });

  return {
    ok: results.every((item) => item.pass),
    total: results.length,
    passed: results.filter((item) => item.pass).length,
    failed: results.filter((item) => !item.pass).length,
    rawTextParsing: false,
    phraseMatching: false,
    runtimeConnected: false,
    results,
  };
}

export function formatMeaningIntentBoundarySelfTestReport(report = runMeaningIntentBoundarySelfTest()) {
  const lines = [
    "Meaning Intent Boundary Self-Test",
    `ok: ${String(report.ok === true)}`,
    `total: ${report.total ?? 0}`,
    `passed: ${report.passed ?? 0}`,
    `failed: ${report.failed ?? 0}`,
    `rawTextParsing: ${String(report.rawTextParsing === true)}`,
    `phraseMatching: ${String(report.phraseMatching === true)}`,
    `runtimeConnected: ${String(report.runtimeConnected === true)}`,
  ];

  for (const item of report.results || []) {
    lines.push(
      "",
      `${item.pass ? "✅" : "❌"} ${item.name}`,
      `expected: ${item.expected?.reason || "unknown"}`,
      `actual: ${item.actual?.reason || "unknown"}`,
      `intentKey: ${item.actual?.intentKey || "null"}`
    );
  }

  return lines.join("\n");
}

export default {
  runMeaningIntentBoundarySelfTest,
  formatMeaningIntentBoundarySelfTestReport,
};
