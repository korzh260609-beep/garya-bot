/**
 * Decision Planner Compare
 *
 * Responsibility:
 * - analyzes planner replay result
 * - evaluates planner match quality
 * - provides structured diagnostics
 *
 * IMPORTANT:
 * - sandbox only
 * - no production integration
 * - no side effects
 */

function createEmptyAnalysis() {
  return {
    ok: false,
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      passRate: 0,
    },
    mismatches: {
      kind: 0,
      workerType: 0,
      requiresJudge: 0,
      requiresAI: 0,
    },
    failedItems: [],
  };
}

export function analyzeDecisionPlannerReplay(replay = {}) {
  const items = Array.isArray(replay?.items) ? replay.items : [];

  if (items.length === 0) {
    return createEmptyAnalysis();
  }

  const analysis = {
    ok: replay?.ok || false,
    summary: {
      total: items.length,
      passed: 0,
      failed: 0,
      passRate: 0,
    },
    mismatches: {
      kind: 0,
      workerType: 0,
      requiresJudge: 0,
      requiresAI: 0,
    },
    failedItems: [],
  };

  for (const item of items) {
    const matched = item?.matched === true;

    if (matched) {
      analysis.summary.passed += 1;
      continue;
    }

    analysis.summary.failed += 1;

    if (item?.compare?.sameKind !== true) {
      analysis.mismatches.kind += 1;
    }

    if (item?.compare?.sameWorkerType !== true) {
      analysis.mismatches.workerType += 1;
    }

    if (item?.compare?.sameRequiresJudge !== true) {
      analysis.mismatches.requiresJudge += 1;
    }

    if (item?.compare?.sameRequiresAI !== true) {
      analysis.mismatches.requiresAI += 1;
    }

    analysis.failedItems.push({
      id: item?.id || null,
      title: item?.title || null,
      compare: item?.compare || null,
      expected: item?.expected || null,
      actual: {
        kind: item?.result?.kind || null,
        workerType: item?.result?.workerType || null,
        requiresJudge: Boolean(item?.result?.executionProposal?.requiresJudge),
        requiresAI: Boolean(item?.result?.executionProposal?.requiresAI),
      },
      warnings: item?.result?.warnings || [],
    });
  }

  analysis.summary.passRate = Number(
    ((analysis.summary.passed / analysis.summary.total) * 100).toFixed(2)
  );

  return analysis;
}