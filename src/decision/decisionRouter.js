export async function routeDecision(input) {
  return {
    kind: "unknown",
    needsAI: false,
    workerType: "none",
    judgeRequired: false,
    reason: "not_implemented",
  };
}