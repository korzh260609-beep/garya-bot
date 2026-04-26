// src/bot/diagnostics/commandPolicyCoverage.js
// ============================================================================
// STAGE 7A — Command policy coverage diagnostic helper
// Purpose:
// - compare legacy PRIVATE_ONLY_COMMANDS with new COMMAND_POLICIES
// - keep runtime behavior unchanged
// - do NOT execute command handlers here
// - do NOT replace dispatcher gates here
// ============================================================================

import { PRIVATE_ONLY_COMMANDS } from "../constants/privateOnlyCommands.js";
import { COMMAND_POLICIES } from "../../core/commandPolicy/commandPolicies.js";

function safeCommand(value) {
  const text = String(value ?? "").trim();

  if (!text || !text.startsWith("/")) {
    return null;
  }

  return text.split("@")[0];
}

function sortedUniqueCommands(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => safeCommand(value))
        .filter(Boolean)
    )
  ).sort();
}

export function buildCommandPolicyCoverageReport() {
  const legacyPrivateCommands = sortedUniqueCommands(Array.from(PRIVATE_ONLY_COMMANDS));
  const policyCommands = sortedUniqueCommands(
    COMMAND_POLICIES.map((policy) => policy?.command)
  );

  const legacySet = new Set(legacyPrivateCommands);
  const policySet = new Set(policyCommands);

  const missingInPolicies = legacyPrivateCommands.filter((command) => !policySet.has(command));
  const extraInPolicies = policyCommands.filter((command) => !legacySet.has(command));

  return {
    ok: missingInPolicies.length === 0 && extraInPolicies.length === 0,
    legacyPrivateCount: legacyPrivateCommands.length,
    policyCount: policyCommands.length,
    missingInPolicies,
    extraInPolicies,
  };
}

export function formatCommandPolicyCoverageReport(report = buildCommandPolicyCoverageReport()) {
  const lines = [
    "Command Policy Coverage",
    `ok: ${String(report.ok === true)}`,
    `legacyPrivateCount: ${report.legacyPrivateCount ?? 0}`,
    `policyCount: ${report.policyCount ?? 0}`,
    `missingInPolicies: ${(report.missingInPolicies || []).length}`,
    `extraInPolicies: ${(report.extraInPolicies || []).length}`,
  ];

  if (Array.isArray(report.missingInPolicies) && report.missingInPolicies.length) {
    lines.push("", "Missing in COMMAND_POLICIES:");
    for (const command of report.missingInPolicies) {
      lines.push(`- ${command}`);
    }
  }

  if (Array.isArray(report.extraInPolicies) && report.extraInPolicies.length) {
    lines.push("", "Extra in COMMAND_POLICIES:");
    for (const command of report.extraInPolicies) {
      lines.push(`- ${command}`);
    }
  }

  return lines.join("\n");
}

export default {
  buildCommandPolicyCoverageReport,
  formatCommandPolicyCoverageReport,
};
