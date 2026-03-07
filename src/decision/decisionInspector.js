/**
 * Decision Inspector
 *
 * Responsibility:
 * - reads sandbox decision memory
 * - provides lightweight diagnostics helpers
 * - does NOT modify decision flow
 *
 * IMPORTANT:
 * - sandbox only
 * - read-only helpers
 * - no external side effects
 */

import { getDecisionMemory, getRecentDecisionMemory } from "./decisionMemory.js";

export function getLastDecision() {
  const decisions = getRecentDecisionMemory(1);
  return decisions[0] || null;
}

export function getLastRoute() {
  const lastDecision = getLastDecision();
  return lastDecision?.route || null;
}

export function getDecisionStats() {
  const decisions = getDecisionMemory();

  const stats = {
    total: decisions.length,
    ok: 0,
    failed: 0,
    approved: 0,
    rejected: 0,
  };

  for (const decision of decisions) {
    if (decision?.ok) {
      stats.ok += 1;
    } else {
      stats.failed += 1;
    }

    if (decision?.judgeResult?.approved === true) {
      stats.approved += 1;
    }

    if (decision?.judgeResult?.approved === false) {
      stats.rejected += 1;
    }
  }

  return stats;
}

export function getRouteStats() {
  const decisions = getDecisionMemory();

  const stats = {};

  for (const decision of decisions) {
    const routeKind = decision?.route?.kind || "unknown";

    if (!stats[routeKind]) {
      stats[routeKind] = 0;
    }

    stats[routeKind] += 1;
  }

  return stats;
}

export function getWarningStats() {
  const decisions = getDecisionMemory();

  const stats = {};

  for (const decision of decisions) {
    const warnings = Array.isArray(decision?.warnings)
      ? decision.warnings
      : [];

    for (const warning of warnings) {
      if (!stats[warning]) {
        stats[warning] = 0;
      }

      stats[warning] += 1;
    }
  }

  return stats;
}