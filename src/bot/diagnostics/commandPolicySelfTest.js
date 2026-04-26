// src/bot/diagnostics/commandPolicySelfTest.js
// ============================================================================
// STAGE 7A — Command policy self-test helper
// Purpose:
// - test CommandPolicyService.evaluate() in shadow mode
// - keep runtime command gates unchanged
// - do NOT execute command handlers here
// - do NOT replace PRIVATE_ONLY_COMMANDS here
// ============================================================================

import { CommandPolicyService } from "../../core/commandPolicy/CommandPolicyService.js";
import { COMMAND_POLICIES } from "../../core/commandPolicy/commandPolicies.js";

function testCase({ name, input, expected }) {
  return { name, input, expected };
}

function pickDecision(decision = {}) {
  return {
    allowed: decision.allowed === true,
    blocked: decision.blocked === true,
    reason: decision.reason || null,
  };
}

function matchesExpected(actual = {}, expected = {}) {
  return (
    actual.allowed === expected.allowed &&
    actual.blocked === expected.blocked &&
    actual.reason === expected.reason
  );
}

export function runCommandPolicySelfTest() {
  const service = new CommandPolicyService({ policies: COMMAND_POLICIES });

  const cases = [
    testCase({
      name: "private command allowed in private chat",
      input: {
        command: "/memory_status",
        transport: "telegram",
        isPrivate: true,
        isMonarch: false,
        bypass: false,
      },
      expected: {
        allowed: true,
        blocked: false,
        reason: "allowed_by_policy",
      },
    }),

    testCase({
      name: "private command blocked in group chat",
      input: {
        command: "/memory_status",
        transport: "telegram",
        isPrivate: false,
        isMonarch: false,
        bypass: false,
      },
      expected: {
        allowed: false,
        blocked: true,
        reason: "private_only",
      },
    }),

    testCase({
      name: "trusted project memory write blocked without bypass",
      input: {
        command: "/pm_confirmed_write",
        transport: "telegram",
        isPrivate: true,
        isMonarch: true,
        bypass: false,
      },
      expected: {
        allowed: false,
        blocked: true,
        reason: "trusted_path_required",
      },
    }),

    testCase({
      name: "trusted project memory write allowed with bypass",
      input: {
        command: "/pm_confirmed_write",
        transport: "telegram",
        isPrivate: true,
        isMonarch: true,
        bypass: true,
      },
      expected: {
        allowed: true,
        blocked: false,
        reason: "allowed_by_policy",
      },
    }),

    testCase({
      name: "repo command blocked for non-monarch private user",
      input: {
        command: "/repo_status",
        transport: "telegram",
        isPrivate: true,
        isMonarch: false,
        bypass: false,
      },
      expected: {
        allowed: false,
        blocked: true,
        reason: "monarch_only",
      },
    }),

    testCase({
      name: "unknown command allowed by default",
      input: {
        command: "/unknown_shadow_command",
        transport: "telegram",
        isPrivate: false,
        isMonarch: false,
        bypass: false,
      },
      expected: {
        allowed: true,
        blocked: false,
        reason: "allowed_by_default",
      },
    }),

    testCase({
      name: "invalid command blocked",
      input: {
        command: "not_a_command",
        transport: "telegram",
        isPrivate: true,
        isMonarch: true,
        bypass: true,
      },
      expected: {
        allowed: false,
        blocked: true,
        reason: "invalid_command",
      },
    }),
  ];

  const results = cases.map((item) => {
    const decision = service.evaluate(item.input);
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
    results,
  };
}

export function formatCommandPolicySelfTestReport(report = runCommandPolicySelfTest()) {
  const lines = [
    "Command Policy Self-Test",
    `ok: ${String(report.ok === true)}`,
    `total: ${report.total ?? 0}`,
    `passed: ${report.passed ?? 0}`,
    `failed: ${report.failed ?? 0}`,
  ];

  for (const item of report.results || []) {
    lines.push(
      "",
      `${item.pass ? "✅" : "❌"} ${item.name}`,
      `expected: ${item.expected?.reason || "unknown"}`,
      `actual: ${item.actual?.reason || "unknown"}`
    );
  }

  return lines.join("\n");
}

export default {
  runCommandPolicySelfTest,
  formatCommandPolicySelfTestReport,
};
