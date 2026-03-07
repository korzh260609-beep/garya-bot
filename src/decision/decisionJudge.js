/**
 * Decision Layer — Judge
 *
 * Responsibility:
 * - accepts worker result
 * - validates / approves output
 * - may pass warnings forward
 * - does NOT execute external actions
 * - does NOT wire itself into production behavior yet
 *
 * Expected workerResult shape:
 * {
 *   ok: boolean,
 *   route: object,
 *   facts: Array,
 *   draft: string | null,
 *   warnings: string[],
 * }
 *
 * Expected context shape:
 * {
 *   messageText?: string,
 *   command?: string,
 *   transport?: string,
 *   user?: object,
 *   chat?: object,
 *   meta?: object,
 * }
 *
 * Expected output shape:
 * {
 *   ok: boolean,
 *   approved: boolean,
 *   finalText: string | null,
 *   warnings: string[],
 *   reason: string,
 * }
 */

export async function judgeDecisionResult(workerResult, context) {
  void context;

  return {
    ok: true,
    approved: true,
    finalText: workerResult?.draft || null,
    warnings: workerResult?.warnings || [],
    reason: "judge_not_implemented",
  };
}