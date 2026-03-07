export async function runDecisionWorker(route, context) {
  return {
    ok: true,
    route,
    facts: [],
    draft: null,
    warnings: ["worker_not_implemented"],
  };
}