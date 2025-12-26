import { makeReport, printReport } from "./report.js";
import { checkStructure } from "./checks/structure.js";

export function runDiagnostics(options = {}) {
  const report = makeReport();

  try {
    checkStructure(report, options);
  } catch (e) {
    report.addFail("Diagnostics crashed", e?.message || String(e));
  }

  const ok = printReport(report, "SG-DIAG");
  return { ok, report };
}

