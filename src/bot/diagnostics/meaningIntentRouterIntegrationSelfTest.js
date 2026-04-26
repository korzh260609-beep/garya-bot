// src/bot/diagnostics/meaningIntentRouterIntegrationSelfTest.js
// ============================================================================
// STAGE 7A — Meaning Intent → Intent Action Router integration self-test
// Purpose:
// - test the isolated structured-intent chain
// - verify MeaningIntentBoundary output can feed IntentActionRouter
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
import {
  IntentActionRouter,
  INTENT_ACTION_SCOPES,
  INTENT_ACTION_STATUS,
} from "../../core/intentAction/IntentActionRouter.js";

const TEST_ACTIONS = Object.freeze([
  {
    actionKey: "project.repo.status",
    intentKeys: ["project_repo_status"],
    handlerKey: "projectRepo.status",
    commandKey: "/repo_status",
    scope: INTENT_ACTION_SCOPES.PROJECT_REPO,
    status: INTENT_ACTION_STATUS.SHADOW,
    monarchOnly: true,
    privateOnly: true,
    requiresTrustedPath: true,
  },
  {
    actionKey: "memory.status",
    intentKeys: ["memory_status_check"],
    handlerKey: "memory.status",
    commandKey: "/memory_status",
    scope: INTENT_ACTION_SCOPES.MEMORY_DIAGNOSTICS,
    status: INTENT_ACTION_STATUS.SHADOW,
    monarchOnly: false,
    privateOnly: true,
    requiresTrustedPath: false,
  },
]);

function testCase({ name, input, expected, boundaryOptions = {}, actions = TEST_ACTIONS }) {
  return { name, input, expected, boundaryOptions, actions };
}

function pickActual({ boundaryDecision = {}, routerDecision = null } = {}) {
  return {
    boundaryAccepted: boundaryDecision.accepted === true,
    boundaryReason: boundaryDecision.reason || null,
    routerMatched: routerDecision?.matched === true,
    routerReason: routerDecision?.reason || null,
    actionKey: routerDecision?.actionKey || null,
    rawTextUsed: boundaryDecision.rawTextUsed === true,
    phraseMatching: boundaryDecision.phraseMatching === true,
  };
}

function matchesExpected(actual = {}, expected = {}) {
  return (
    actual.boundaryAccepted === expected.boundaryAccepted &&
    actual.boundaryReason === expected.boundaryReason &&
    actual.routerMatched === expected.routerMatched &&
    actual.routerReason === expected.routerReason &&
    actual.actionKey === expected.actionKey
  );
}

export function runMeaningIntentRouterIntegrationSelfTest() {
  const cases = [
    testCase({
      name: "accepted structured intent routes to shadow action",
      input: {
        intentKey: "project_repo_status",
        source: MEANING_INTENT_SOURCES.AI,
        confidence: 0.88,
        rawTextUsed: false,
        phraseMatching: false,
      },
      expected: {
        boundaryAccepted: true,
        boundaryReason: "accepted_structured_intent",
        routerMatched: true,
        routerReason: "matched_shadow_action",
        actionKey: "project.repo.status",
      },
    }),

    testCase({
      name: "accepted robot intent routes to memory action",
      input: {
        intentKey: "memory_status_check",
        source: MEANING_INTENT_SOURCES.ROBOT,
        confidence: 0.91,
      },
      expected: {
        boundaryAccepted: true,
        boundaryReason: "accepted_structured_intent",
        routerMatched: true,
        routerReason: "matched_shadow_action",
        actionKey: "memory.status",
      },
    }),

    testCase({
      name: "accepted structured intent with no route returns no action match",
      input: {
        intentKey: "unknown_structured_intent",
        source: MEANING_INTENT_SOURCES.AI,
        confidence: 0.9,
      },
      expected: {
        boundaryAccepted: true,
        boundaryReason: "accepted_structured_intent",
        routerMatched: false,
        routerReason: "no_action_match",
        actionKey: null,
      },
    }),

    testCase({
      name: "raw text usage stops before router",
      input: {
        intentKey: "project_repo_status",
        source: MEANING_INTENT_SOURCES.AI,
        confidence: 0.9,
        rawTextUsed: true,
      },
      expected: {
        boundaryAccepted: false,
        boundaryReason: "raw_text_not_allowed",
        routerMatched: false,
        routerReason: null,
        actionKey: null,
      },
    }),

    testCase({
      name: "phrase matching stops before router",
      input: {
        intentKey: "project_repo_status",
        source: MEANING_INTENT_SOURCES.AI,
        confidence: 0.9,
        phraseMatching: true,
      },
      expected: {
        boundaryAccepted: false,
        boundaryReason: "phrase_or_keyword_matching_not_allowed",
        routerMatched: false,
        routerReason: null,
        actionKey: null,
      },
    }),

    testCase({
      name: "low confidence stops before router",
      boundaryOptions: {
        minConfidence: 0.75,
      },
      input: {
        intentKey: "project_repo_status",
        source: MEANING_INTENT_SOURCES.AI,
        confidence: 0.4,
      },
      expected: {
        boundaryAccepted: false,
        boundaryReason: "confidence_below_threshold",
        routerMatched: false,
        routerReason: null,
        actionKey: null,
      },
    }),
  ];

  const results = cases.map((item) => {
    const boundary = new MeaningIntentBoundary(item.boundaryOptions);
    const router = new IntentActionRouter({ actions: item.actions });

    const boundaryDecision = boundary.validate(item.input);
    const routerInput = boundary.toRouterInput(boundaryDecision);
    const routerDecision = routerInput ? router.resolve(routerInput) : null;
    const actual = pickActual({ boundaryDecision, routerDecision });
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
    handlerExecution: false,
    runtimeConnected: false,
    results,
  };
}

export function formatMeaningIntentRouterIntegrationSelfTestReport(
  report = runMeaningIntentRouterIntegrationSelfTest()
) {
  const lines = [
    "Meaning Intent → Router Integration Self-Test",
    `ok: ${String(report.ok === true)}`,
    `total: ${report.total ?? 0}`,
    `passed: ${report.passed ?? 0}`,
    `failed: ${report.failed ?? 0}`,
    `rawTextParsing: ${String(report.rawTextParsing === true)}`,
    `phraseMatching: ${String(report.phraseMatching === true)}`,
    `handlerExecution: ${String(report.handlerExecution === true)}`,
    `runtimeConnected: ${String(report.runtimeConnected === true)}`,
  ];

  for (const item of report.results || []) {
    lines.push(
      "",
      `${item.pass ? "✅" : "❌"} ${item.name}`,
      `boundary: ${item.actual?.boundaryReason || "null"}`,
      `router: ${item.actual?.routerReason || "null"}`,
      `actionKey: ${item.actual?.actionKey || "null"}`
    );
  }

  return lines.join("\n");
}

export default {
  runMeaningIntentRouterIntegrationSelfTest,
  formatMeaningIntentRouterIntegrationSelfTestReport,
};
