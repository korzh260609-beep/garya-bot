export async function judgeDecisionResult(workerResult, context) {
  return {
    ok: true,
    approved: true,
    finalText: workerResult?.draft || null,
    warnings: workerResult?.warnings || [],
    reason: "judge_not_implemented",
  };
}