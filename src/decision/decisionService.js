/**
 * Decision Service
 *
 * Responsibility:
 * - stable service wrapper for Decision Layer
 * - provides safe API for future Core integration
 * - does NOT modify production pipeline
 * - does NOT execute external side effects
 */

import { executeDecision } from "./decisionExecutor.js";

export async function runDecisionService(input = {}) {
  const result = await executeDecision(input);

  return {
    ok: result?.ok || false,
    route: result?.route || null,
    finalText: result?.finalText || null,
    warnings: result?.warnings || [],
    raw: result,
  };
}