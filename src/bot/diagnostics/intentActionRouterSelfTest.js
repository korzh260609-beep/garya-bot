// src/bot/diagnostics/intentActionRouterSelfTest.js
// ============================================================================
// STAGE 7A — Intent Action Router self-test helper
// Purpose:
// - test IntentActionRouter behavior in isolation
// - keep runtime behavior unchanged
// - do NOT execute handlers here
// - do NOT parse raw user text here
// - do NOT match keywords or fixed phrases here
// - do NOT connect this diagnostic to Telegram/runtime here
// ============================================================================

import {
  IntentActionRouter,
  INTENT_ACTION_SCOPES,
  INTENT_ACTION_STATUS,
} from "../../core/intentAction/IntentActionRouter.js";

function testCase({ name, routerActions, input, expected }) {
  return { name, routerActions, input, expected };
}

function pickDecision(decision = {}) {
  return {
    matched: decision.matched === true,
    reason: decision.reason || null,
    actionKey: decision.actionKey || null,
  };
}

function matchesExpected(actual = {}, expected = {}) {
  return (
    actual.matched === expected.matched &&
    actual.reason === expected.reason &&
    actual.actionKey === expected.actionKey
  );
}

export function runIntentActionRouterSelfTest() {
  const cases = [
    testCase({
      name: "missing structured intent returns no match",
      routerActions: [],
      input: {},
      expected: {
        matched: false,
        reason: "missing_structured_intent",
        actionKey: null,
      },
    }),

    testCase({
      name: "unknown structured intent returns no action match",
      routerActions: [],
      input: {
        intentKey: "unknown_intent",
      },
      expected: {
        matched: false,
        reason: "no_action_match",
        actionKey: null,
      },
    }),

    testCase({
      name: "shadow action matches structured intent",
      routerActions: [
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
      ],
      input: {
        intentKey: "project_repo_status",
      },
      expected: {
        matched: true,
        reason: "matched_shadow_action",
        actionKey: "project.repo.status",
      },
    }),

    testCase({
      name: "active action matches structured intent",
      routerActions: [
        {
          actionKey: "memory.status",
          intentKeys: ["memory_status_check"],
          handlerKey: "memory.status",
          commandKey: "/memory_status",
          scope: INTENT_ACTION_SCOPES.MEMORY_DIAGNOSTICS,
          status: INTENT_ACTION_STATUS.ACTIVE,
          monarchOnly: false,
          privateOnly: true,
          requiresTrustedPath: false,
        },
      ],
      input: {
        intent: {
          intentKey: "memory_status_check",
        },
      },
      expected: {
        matched: true,
        reason: "matched_active_action",
        actionKey: "memory.status",
      },
    }),

    testCase({
      name: "disabled action returns disabled decision",
      routerActions: [
        {
          actionKey: "sources.news.rss",
          intentKeys: ["sources_news_rss"],
          handlerKey: "sources.newsRss",
          commandKey: "/news_rss",
          scope: INTENT_ACTION_SCOPES.SOURCES,
          status: INTENT_ACTION_STATUS.DISABLED,
          monarchOnly: false,
          privateOnly: true,
          requiresTrustedPath: false,
        },
      ],
      input: {
        intentKey: "sources_news_rss",
      },
      expected: {
        matched: false,
        reason: "action_disabled",
        actionKey: "sources.news.rss",
      },
    }),

    testCase({
      name: "intent.type fallback resolves structured intent",
      routerActions: [
        {
          actionKey: "system.capabilities.list",
          intentKeys: ["capabilities_list"],
          handlerKey: "capabilities.list",
          commandKey: "/capabilities",
          scope: INTENT_ACTION_SCOPES.SYSTEM,
          status: INTENT_ACTION_STATUS.SHADOW,
          monarchOnly: false,
          privateOnly: true,
          requiresTrustedPath: false,
        },
      ],
      input: {
        intent: {
          type: "capabilities_list",
        },
      },
      expected: {
        matched: true,
        reason: "matched_shadow_action",
        actionKey: "system.capabilities.list",
      },
    }),
  ];

  const results = cases.map((item) => {
    const router = new IntentActionRouter({ actions: item.routerActions });
    const decision = router.resolve(item.input);
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

export function formatIntentActionRouterSelfTestReport(report = runIntentActionRouterSelfTest()) {
  const lines = [
    "Intent Action Router Self-Test",
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
      `actionKey: ${item.actual?.actionKey || "null"}`
    );
  }

  return lines.join("\n");
}

export default {
  runIntentActionRouterSelfTest,
  formatIntentActionRouterSelfTestReport,
};
