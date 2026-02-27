import { makeReport, printReport } from "./report.js";
import { checkStructure } from "./checks/structure.js";
import { checkRoles, checkRolesV2 } from "./checks/roles.js";
import { getFeatureFlags } from "../src/core/config.js";

export async function runDiagnostics(options = {}) {
  const report = makeReport();

  try {
    checkStructure(report, options);

    const flags = getFeatureFlags();
    const fn = flags?.DIAG_ROLES_V2 ? checkRolesV2 : checkRoles;

    await fn(report, options);
  } catch (e) {
    report.addFail("Diagnostics crashed", e?.message || String(e));
  }

  const ok = printReport(report, "SG-DIAG");
  return { ok, report };
}
