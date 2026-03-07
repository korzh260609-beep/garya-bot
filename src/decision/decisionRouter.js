/**
 * Decision Route Contract
 *
 * Defines normalized structure returned by Decision Router.
 *
 * Router must return an object with this shape.
 * Worker and Judge rely on this structure.
 *
 * This file contains NO routing logic.
 */

export function createDecisionRoute(data = {}) {
  return {
    kind: data.kind || "unknown",

    needsAI: data.needsAI || false,

    workerType: data.workerType || "none",

    judgeRequired: data.judgeRequired || false,

    reason: data.reason || "not_defined",
  };
}