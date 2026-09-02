import { describe, expect, it } from "vitest";
import { buildSgCostDiagnostic, type SgCostDiagnosticConfig } from "./cost-diagnostics.js";

const protectedConfig: SgCostDiagnosticConfig = {
  session: { dmScope: "per-channel-peer" },
  agents: {
    defaults: {
      compaction: {
        enabled: true,
        mode: "safeguard",
        keepRecentTokens: 12000,
        recentTurnsPreserve: 4,
        identifierPolicy: "off",
        qualityGuard: { enabled: true, maxRetries: 1 },
        midTurnPrecheck: { enabled: true },
        memoryFlush: { enabled: false },
        maxActiveTranscriptBytes: "128kb",
      },
      contextPruning: {
        mode: "cache-ttl",
        ttl: "5m",
        hardClear: { enabled: true },
      },
    },
  },
};

describe("SG cost diagnostics", () => {
  it("passes an isolated and bounded direct session", () => {
    const result = buildSgCostDiagnostic({
      config: protectedConfig,
      channel: "telegram",
      sessionKey: "agent:main:telegram:direct:100",
    });
    expect(result).toContain("SG COST DIAG — PASS");
    expect(result).toContain("current_session: PASS (isolated)");
    expect(result).toContain("summary: pass=9, fail=0");
  });

  it("fails the old shared-session configuration", () => {
    const result = buildSgCostDiagnostic({
      config: {},
      channel: "telegram",
      sessionKey: "agent:main:main",
    });
    expect(result).toContain("SG COST DIAG — FAIL");
    expect(result).toContain("dm_scope: FAIL (unset)");
    expect(result).toContain("current_session: FAIL (shared-or-unknown)");
  });
});
