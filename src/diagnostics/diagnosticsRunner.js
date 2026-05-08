// AGENT NOTE:
// SG 2.0 Diagnostics Layer runner skeleton.
// Purpose: provide a bounded public diagnostics entry point without coupling diagnostics to Telegram or core message handling.
// This first skeleton prepares a plan and a report shape; deeper tool orchestration is added in a later logic PR.

import { detectDiagnosticsIntent } from "./diagnosticsIntent.js";
import { buildDiagnosticsPlan } from "./diagnosticsPlan.js";
import { buildDiagnosticsReport } from "./diagnosticsReport.js";

export async function runDiagnosticsCheck(input = {}, context = {}) {
  if (!context?.isMonarch) {
    return {
      ok: false,
      type: "sg_diagnostics_check",
      error: "sg_diagnostics_not_allowed",
    };
  }

  const text = typeof input.text === "string" && input.text.trim()
    ? input.text.trim()
    : String(context.latestUserText || "").trim();
  const intent = detectDiagnosticsIntent({ text });
  const plan = buildDiagnosticsPlan({
    text,
    intent,
    checks: input.checks,
  });
  const report = buildDiagnosticsReport({
    plan,
    results: [
      {
        ok: true,
        type: "diagnostics_skeleton_ready",
        summary: "Diagnostics skeleton created. Deep runtime tool orchestration must be added in the logic step.",
      },
    ],
  });

  return {
    ok: true,
    type: "sg_diagnostics_check",
    mode: "skeleton_only",
    text,
    intent,
    plan,
    report,
  };
}
