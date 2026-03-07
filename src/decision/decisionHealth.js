/**
 * Decision Health Monitor
 *
 * Responsibility:
 * - provides health diagnostics for Decision Layer
 * - calculates aggregate sandbox metrics from Decision memory
 * - does NOT modify decision flow
 * - does NOT touch production pipeline
 *
 * IMPORTANT:
 * - sandbox only
 * - read-only diagnostics
 * - no external side effects
 */

import { getDecisionMemory } from "./decisionMemory.js";

function toSafeRate(value, total) {
  if (!total || total <= 0) {
    return 0;
  }

  return Number((value / total).toFixed(4));
}

function createEmptyHealth() {
  return {
    total: 0,
    decisionErrorRate: 0,
    validatorWarningRate: 0,
    routeDistribution: {},
    workerReliability: {},
    judgeApprovalRate: 0,
  };
}

function getValidatorWarningsCount(decision = {}) {
  const validator = decision?.trace?.validator || {};

  const routeWarnings = Array.isArray(validator.routeWarnings)
    ? validator.routeWarnings.length
    : 0;

  const workerWarnings = Array.isArray(validator.workerWarnings)
    ? validator.workerWarnings.length
    : 0;

  const judgeWarnings = Array.isArray(validator.judgeWarnings)
    ? validator.judgeWarnings.length
    : 0;

  return routeWarnings + workerWarnings + judgeWarnings;
}

export function getDecisionHealth() {
  const decisions = getDecisionMemory();

  if (!Array.isArray(decisions) || decisions.length === 0) {
    return createEmptyHealth();
  }

  let failedCount = 0;
  let validatorWarningDecisionCount = 0;

  let judgedCount = 0;
  let judgeApprovedCount = 0;

  const routeDistribution = {};
  const workerReliability = {};

  for (const decision of decisions) {
    if (!decision?.ok) {
      failedCount += 1;
    }

    if (getValidatorWarningsCount(decision) > 0) {
      validatorWarningDecisionCount += 1;
    }

    const routeKind = decision?.route?.kind || "unknown";
    routeDistribution[routeKind] = (routeDistribution[routeKind] || 0) + 1;

    const workerType = decision?.route?.workerType || "unknown";
    if (!workerReliability[workerType]) {
      workerReliability[workerType] = {
        total: 0,
        ok: 0,
        failed: 0,
        reliabilityRate: 0,
      };
    }

    workerReliability[workerType].total += 1;

    if (decision?.workerResult?.ok === true) {
      workerReliability[workerType].ok += 1;
    } else {
      workerReliability[workerType].failed += 1;
    }

    if (typeof decision?.judgeResult?.approved === "boolean") {
      judgedCount += 1;

      if (decision.judgeResult.approved === true) {
        judgeApprovedCount += 1;
      }
    }
  }

  for (const workerType of Object.keys(workerReliability)) {
    const stats = workerReliability[workerType];

    stats.reliabilityRate = toSafeRate(stats.ok, stats.total);
  }

  return {
    total: decisions.length,
    decisionErrorRate: toSafeRate(failedCount, decisions.length),
    validatorWarningRate: toSafeRate(
      validatorWarningDecisionCount,
      decisions.length
    ),
    routeDistribution,
    workerReliability,
    judgeApprovalRate: toSafeRate(judgeApprovedCount, judgedCount),
  };
}