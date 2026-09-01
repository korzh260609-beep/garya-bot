export type SgCostDiagnosticConfig = {
  session?: { dmScope?: string };
  agents?: {
    defaults?: {
      compaction?: {
        enabled?: boolean;
        mode?: string;
        keepRecentTokens?: number;
        recentTurnsPreserve?: number;
        identifierPolicy?: string;
        qualityGuard?: { enabled?: boolean; maxRetries?: number };
        midTurnPrecheck?: { enabled?: boolean };
        memoryFlush?: { enabled?: boolean };
        maxActiveTranscriptBytes?: number | string;
      };
      contextPruning?: {
        mode?: string;
        ttl?: string;
        hardClear?: { enabled?: boolean };
      };
    };
  };
};

type CostCheck = { name: string; pass: boolean; detail: string };

function check(name: string, pass: boolean, detail: string): CostCheck {
  return { name, pass, detail };
}

export function buildSgCostDiagnostic(input: {
  config: SgCostDiagnosticConfig;
  channel: string;
  sessionKey?: string;
}): string {
  const compaction = input.config.agents?.defaults?.compaction;
  const pruning = input.config.agents?.defaults?.contextPruning;
  const normalizedChannel = input.channel.trim().toLowerCase();
  const isolatedSessionMarker = `:${normalizedChannel}:direct:`;
  const checks = [
    check(
      "dm_scope",
      input.config.session?.dmScope === "per-channel-peer",
      input.config.session?.dmScope ?? "unset",
    ),
    check(
      "current_session",
      Boolean(input.sessionKey?.includes(isolatedSessionMarker)),
      input.sessionKey?.includes(isolatedSessionMarker) ? "isolated" : "shared-or-unknown",
    ),
    check(
      "compaction",
      compaction?.enabled === true && compaction.mode === "safeguard",
      `enabled=${String(compaction?.enabled)},mode=${compaction?.mode ?? "unset"}`,
    ),
    check(
      "transcript_guard",
      compaction?.maxActiveTranscriptBytes === "128kb",
      String(compaction?.maxActiveTranscriptBytes ?? "unset"),
    ),
    check(
      "recent_context",
      compaction?.keepRecentTokens === 12000 && compaction.recentTurnsPreserve === 4,
      `tokens=${compaction?.keepRecentTokens ?? "unset"},turns=${compaction?.recentTurnsPreserve ?? "unset"}`,
    ),
    check(
      "summary_safety",
      compaction?.identifierPolicy === "strict" &&
        compaction.qualityGuard?.enabled === true &&
        compaction.qualityGuard.maxRetries === 1,
      `identifiers=${compaction?.identifierPolicy ?? "unset"},quality=${String(compaction?.qualityGuard?.enabled)}`,
    ),
    check(
      "tool_loop_guard",
      compaction?.midTurnPrecheck?.enabled === true,
      `enabled=${String(compaction?.midTurnPrecheck?.enabled)}`,
    ),
    check(
      "shared_memory_flush",
      compaction?.memoryFlush?.enabled === false,
      `enabled=${String(compaction?.memoryFlush?.enabled)}`,
    ),
    check(
      "tool_result_pruning",
      pruning?.mode === "cache-ttl" && pruning.ttl === "5m" && pruning.hardClear?.enabled === true,
      `mode=${pruning?.mode ?? "unset"},ttl=${pruning?.ttl ?? "unset"}`,
    ),
  ];
  const failed = checks.filter((item) => !item.pass).length;
  return [
    `SG COST DIAG — ${failed === 0 ? "PASS" : "FAIL"}`,
    ...checks.map((item) => `${item.name}: ${item.pass ? "PASS" : "FAIL"} (${item.detail})`),
    `summary: pass=${checks.length - failed}, fail=${failed}`,
    "usage: проверь фактические токены штатной командой /status",
  ].join("\n");
}
