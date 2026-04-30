// src/core/commandPolicy/commandInventoryCoverageCheck.js
// ============================================================================
// COMMAND INVENTORY COVERAGE CHECK — READ-ONLY DIAGNOSTIC HELPER
// ============================================================================
// Purpose:
// - compare the new command inventory with legacy command maps;
// - expose gaps without changing runtime behavior;
// - help migrate slash commands into Technical Mode policy safely.
//
// IMPORTANT:
// - This file is NOT wired into command execution.
// - Do not execute handlers here.
// - Do not route natural language through this file.
// - Do not use this file as Living SG intelligence.
// - This is a diagnostic helper only.
// ============================================================================

import { CMD_ACTION } from "../../bot/cmdActionMap.js";
import { PRIVATE_ONLY_COMMANDS } from "../../bot/constants/privateOnlyCommands.js";
import { COMMAND_INVENTORY } from "./commandInventory.js";
import { COMMAND_POLICIES } from "./commandPolicies.js";

function normalizeCommand(command) {
  return String(command || "").trim().split("@")[0];
}

function uniqueSorted(values) {
  return [...new Set(values.map(normalizeCommand).filter(Boolean))].sort();
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item));
}

function intersection(left, right) {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

export function getInventoryCommands() {
  return uniqueSorted(COMMAND_INVENTORY.map((entry) => entry.command));
}

export function getCmdActionCommands() {
  return uniqueSorted(Object.keys(CMD_ACTION || {}));
}

export function getPrivateOnlyCommands() {
  return uniqueSorted([...(PRIVATE_ONLY_COMMANDS || [])]);
}

export function getCommandPolicyCommands() {
  return uniqueSorted((COMMAND_POLICIES || []).map((policy) => policy.command));
}

export function buildCommandInventoryCoverageReport() {
  const inventory = getInventoryCommands();
  const cmdAction = getCmdActionCommands();
  const privateOnly = getPrivateOnlyCommands();
  const policies = getCommandPolicyCommands();

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    counts: Object.freeze({
      inventory: inventory.length,
      cmdAction: cmdAction.length,
      privateOnly: privateOnly.length,
      policies: policies.length,
    }),
    gaps: Object.freeze({
      inventoryMissingFromCmdAction: difference(inventory, cmdAction),
      cmdActionMissingFromInventory: difference(cmdAction, inventory),
      inventoryMissingFromPrivateOnly: difference(inventory, privateOnly),
      privateOnlyMissingFromInventory: difference(privateOnly, inventory),
      inventoryMissingFromPolicies: difference(inventory, policies),
      policiesMissingFromInventory: difference(policies, inventory),
    }),
    overlaps: Object.freeze({
      inventoryAndCmdAction: intersection(inventory, cmdAction),
      inventoryAndPrivateOnly: intersection(inventory, privateOnly),
      inventoryAndPolicies: intersection(inventory, policies),
    }),
  });
}

export function buildCommandInventoryCoverageSummary() {
  const report = buildCommandInventoryCoverageReport();

  return Object.freeze({
    generatedAt: report.generatedAt,
    counts: report.counts,
    gapCounts: Object.freeze({
      inventoryMissingFromCmdAction: report.gaps.inventoryMissingFromCmdAction.length,
      cmdActionMissingFromInventory: report.gaps.cmdActionMissingFromInventory.length,
      inventoryMissingFromPrivateOnly: report.gaps.inventoryMissingFromPrivateOnly.length,
      privateOnlyMissingFromInventory: report.gaps.privateOnlyMissingFromInventory.length,
      inventoryMissingFromPolicies: report.gaps.inventoryMissingFromPolicies.length,
      policiesMissingFromInventory: report.gaps.policiesMissingFromInventory.length,
    }),
  });
}

export default {
  buildCommandInventoryCoverageReport,
  buildCommandInventoryCoverageSummary,
  getInventoryCommands,
  getCmdActionCommands,
  getPrivateOnlyCommands,
  getCommandPolicyCommands,
};
