import { makeReport, printReport } from "./report.js";
import { checkStructure } from "./checks/structure.js";
import { checkRoles } from "./checks/roles.js";

export async function runDiagnostics(options = {}) {
  const report = makeReport();

  try {
    checkStructure(report, options);
    await checkRoles(report, options);
  } catch (e) {
    report.addFail("Diagnostics crashed", e?.message || String(e));
  }

  const ok = printReport(report, "SG-DIAG");
  return { ok, report };
}
