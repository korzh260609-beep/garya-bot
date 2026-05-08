// AGENT NOTE:
// SG 2.0 Diagnostics Layer report builder.
// Purpose: turn diagnostics facts into a short safe report shape.
// Do not fetch data, execute tools, reveal secrets, or mutate repository state here.

function normalizeCheckResult(result) {
  if (!result || typeof result !== "object") {
    return {
      ok: false,
      type: "unknown_check_result",
      summary: "No structured result returned.",
    };
  }

  return {
    ok: Boolean(result.ok),
    type: result.type || "diagnostics_check_result",
    summary: result.summary || result.error || result.reason || "Structured result collected.",
    data: result.data || null,
  };
}

export function buildDiagnosticsReport(input = {}) {
  const plan = input.plan || null;
  const results = Array.isArray(input.results) ? input.results.map(normalizeCheckResult) : [];
  const failed = results.filter((item) => !item.ok);
  const passed = results.filter((item) => item.ok);

  return {
    ok: failed.length === 0,
    type: "sg_diagnostics_report",
    status: failed.length === 0 ? "no_failed_checks_detected" : "failed_checks_detected",
    plan,
    summary: {
      checked: results.length,
      passed: passed.length,
      failed: failed.length,
    },
    results,
    nextStep: failed.length > 0
      ? "Review failed checks and inspect the most relevant runtime source before changing code."
      : "No failed check was detected from collected diagnostics facts.",
  };
}
