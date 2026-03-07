/**
 * Decision Shadow Runner
 *
 * Responsibility:
 * - runs Decision Layer in isolated shadow mode
 * - measures execution time
 * - returns comparable diagnostics snapshot
 * - does NOT affect production pipeline
 *
 * IMPORTANT:
 * - sandbox only
 * - no Telegram integration
 * - no handleMessage integration
 * - no side effects
 */

import { runDecisionService } from "./decisionService.js";
import { getDecisionHealth } from "./decisionHealth.js";

export async function runDecisionShadow(input = {}) {
  const startedAt = Date.now();

  const serviceResult = await runDecisionService(input);

  const finishedAt = Date.now();
  const durationMs = finishedAt - startedAt;

  return {
    ok: serviceResult?.ok || false,
    mode: "shadow",
    durationMs,
    route: serviceResult?.route || null,
    finalText: serviceResult?.finalText || null,
    warnings: Array.isArray(serviceResult?.warnings)
      ? serviceResult.warnings
      : [],
    health: getDecisionHealth(),
    raw: serviceResult?.raw || null,
  };
}