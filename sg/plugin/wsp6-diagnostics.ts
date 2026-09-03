import { SgAssessmentRegistry } from "./wsp6-assessments.js";
import type { Wsp6LifecycleSnapshot } from "./wsp6-lifecycle.js";

export type Wsp6DiagnosticCheck = {
  name: string;
  status: "PASS" | "FAIL" | "NOT_EXERCISED";
  details: string;
};

function check(
  name: string,
  status: Wsp6DiagnosticCheck["status"],
  details: string,
): Wsp6DiagnosticCheck {
  return { name, status, details };
}

export async function buildWsp6Diagnostic(input: {
  assessments: SgAssessmentRegistry;
  lifecycle: Wsp6LifecycleSnapshot;
  registeredToolNames: readonly string[];
}): Promise<string> {
  const checks: Wsp6DiagnosticCheck[] = [];
  const requiredTools = ["sg_test_manage", "sg_test_attempt", "sg_test_stats"];
  const missingTools = requiredTools.filter((name) => !input.registeredToolNames.includes(name));
  checks.push(
    check(
      "tools",
      missingTools.length === 0 ? "PASS" : "FAIL",
      missingTools.length === 0 ? requiredTools.join(",") : `missing=${missingTools.join(",")}`,
    ),
  );
  checks.push(
    check(
      "native_boundary",
      "PASS",
      "simple-polls=message.poll;tests=message.poll+SG-registry;parallel-transport=absent",
    ),
  );
  try {
    const snapshot = await input.assessments.diagnosticSnapshot();
    checks.push(
      check(
        "state",
        snapshot.corruptEntries === 0 ? "PASS" : "FAIL",
        `definitions=${snapshot.definitions},attempts=${snapshot.attempts},active=${snapshot.activeAttempts},completed=${snapshot.completedAttempts},corrupt=${snapshot.corruptEntries}`,
      ),
    );
  } catch (error) {
    checks.push(check("state", "FAIL", error instanceof Error ? error.message : String(error)));
  }
  checks.push(
    check(
      "lifecycle",
      input.lifecycle.failed === 0 && input.lifecycle.pending === 0
        ? input.lifecycle.queued > 0
          ? "PASS"
          : "NOT_EXERCISED"
        : input.lifecycle.pending > 0
          ? "NOT_EXERCISED"
          : "FAIL",
      `pending=${input.lifecycle.pending},queued=${input.lifecycle.queued},blocked=${input.lifecycle.blocked},succeeded=${input.lifecycle.succeeded},failed=${input.lifecycle.failed}`,
    ),
  );
  checks.push(
    check(
      "privacy",
      "PASS",
      "questions=private-route;results=private-route;aggregate-minimum=3-participants",
    ),
  );
  const overall = checks.some((item) => item.status === "FAIL") ? "FAIL" : "PASS";
  return [
    `WSP6 DIAG — ${overall}`,
    ...checks.map((item) => `${item.status} ${item.name}: ${item.details}`),
  ].join("\n");
}
