import { describe, expect, it, vi } from "vitest";
import type { SgAssessmentRegistry } from "./wsp6-assessments.js";
import { buildWsp6Diagnostic } from "./wsp6-diagnostics.js";

function assessments(snapshot: { corruptEntries: number }) {
  return {
    diagnosticSnapshot: vi.fn(async () => ({
      definitions: 2,
      attempts: 4,
      activeAttempts: 1,
      completedAttempts: 3,
      corruptEntries: snapshot.corruptEntries,
    })),
  } as unknown as SgAssessmentRegistry;
}

const lifecycle = { pending: 0, queued: 3, blocked: 1, succeeded: 2, failed: 0 };

describe("WSP6 diagnostics", () => {
  it("passes with all tools and valid durable state", async () => {
    const result = await buildWsp6Diagnostic({
      assessments: assessments({ corruptEntries: 0 }),
      lifecycle,
      registeredToolNames: ["sg_test_manage", "sg_test_attempt", "sg_test_stats"],
    });
    expect(result).toContain("WSP6 DIAG — PASS");
    expect(result).toContain("PASS native_boundary: simple-polls=message.poll");
    expect(result).toContain("PASS state: definitions=2,attempts=4");
    expect(result).toContain("PASS privacy: questions=private-route");
  });

  it("fails on a missing tool or corrupt state", async () => {
    const result = await buildWsp6Diagnostic({
      assessments: assessments({ corruptEntries: 1 }),
      lifecycle,
      registeredToolNames: ["sg_test_manage", "sg_test_attempt"],
    });
    expect(result).toContain("WSP6 DIAG — FAIL");
    expect(result).toContain("FAIL tools: missing=sg_test_stats");
    expect(result).toContain("FAIL state:");
    expect(result).toContain("corrupt=1");
  });

  it("reports a failed native delivery", async () => {
    const result = await buildWsp6Diagnostic({
      assessments: assessments({ corruptEntries: 0 }),
      lifecycle: { pending: 0, queued: 1, blocked: 0, succeeded: 0, failed: 1 },
      registeredToolNames: ["sg_test_manage", "sg_test_attempt", "sg_test_stats"],
    });
    expect(result).toContain("WSP6 DIAG — FAIL");
    expect(result).toContain("FAIL lifecycle:");
  });
});
