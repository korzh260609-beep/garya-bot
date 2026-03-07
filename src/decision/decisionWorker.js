/**
 * Decision Layer — Worker
 *
 * Responsibility:
 * - accepts route result from Router
 * - prepares facts / draft
 * - does NOT finalize response
 * - does NOT validate final quality
 * - does NOT replace existing handleMessage flow
 *
 * Expected route shape:
 * {
 *   kind: string,
 *   needsAI: boolean,
 *   workerType: string,
 *   judgeRequired: boolean,
 *   reason: string,
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
 *   route: object,
 *   facts: Array,
 *   draft: string | null,
 *   warnings: string[],
 * }
 */

export async function runDecisionWorker(route, context) {
  void context;

  return {
    ok: true,
    route,
    facts: [],
    draft: null,
    warnings: ["worker_not_implemented"],
  };
}