/**
 * Decision Layer — Router
 *
 * Responsibility:
 * - accepts raw decision input
 * - returns normalized routing result
 * - does NOT execute work
 * - does NOT call AI
 * - does NOT touch current production pipeline
 *
 * Expected input shape:
 * {
 *   text?: string,
 *   command?: string,
 *   transport?: string,
 *   userId?: string | number,
 *   chatId?: string | number,
 *   meta?: object,
 * }
 *
 * Expected output shape:
 * {
 *   kind: string,
 *   needsAI: boolean,
 *   workerType: string,
 *   judgeRequired: boolean,
 *   reason: string,
 * }
 */

export async function routeDecision(input) {
  void input;

  return {
    kind: "unknown",
    needsAI: false,
    workerType: "none",
    judgeRequired: false,
    reason: "not_implemented",
  };
}