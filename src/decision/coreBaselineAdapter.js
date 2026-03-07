/**
 * Core Baseline Adapter
 *
 * Responsibility:
 * - builds baseline snapshot from Core behavior
 * - used only for Decision replay comparison
 *
 * IMPORTANT:
 * - sandbox only
 * - does NOT modify production pipeline
 * - does NOT execute external actions
 */

function normalizeWarnings(value) {
  return Array.isArray(value) ? value : [];
}

export function createCoreBaselineSnapshot(coreResult = {}) {
  return {
    finalText:
      coreResult?.finalText == null
        ? null
        : String(coreResult.finalText),

    route: coreResult?.route || {
      kind: "core_baseline",
      worker: "core_handler",
      judgeRequired: false,
    },

    warnings: normalizeWarnings(coreResult?.warnings),

    source: "core_baseline",
  };
}