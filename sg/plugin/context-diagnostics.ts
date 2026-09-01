import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import type { SgCostDiagnosticConfig } from "./cost-diagnostics.js";

const MAX_EVENTS = 500;
const MAX_INSTANCE_FILES = 20;
const DIAGNOSTIC_VERSION = "sg-context-e2e-v1";
const CLEARED_TOOL_RESULT = "[Old tool result content cleared]";

type DiagnosticApi = Pick<OpenClawPluginApi, "on"> & {
  logger?: { warn(message: string): void };
};

type Facts = Record<string, string | number | boolean>;

type ContextEvent = {
  version: 1;
  recordedAt: string;
  instanceId: string;
  stage: string;
  sessionHash: string;
  sessionIdHash: string;
  runHash: string;
  facts: Facts;
};

export type SgContextDiagnosticCommand = {
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  sessionTarget?: {
    agentId: string;
    sessionId: string;
    sessionKey: string;
    storePath: string;
  };
  args?: string;
  config: SgCostDiagnosticConfig;
  runtimeContext?: {
    compactCurrent?: () => Promise<CompactionProbeResult>;
  };
};

type CompactionProbeResult = {
  compacted: boolean;
  reason?: string;
  tokensBefore?: number;
  tokensAfter?: number;
};

function hash(value: unknown): string {
  const text = typeof value === "string" && value.trim() ? value : "missing";
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

function jsonText(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

function bytes(value: unknown): number {
  return Buffer.byteLength(typeof value === "string" ? value : jsonText(value), "utf8");
}

function roleOf(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "unknown";
  }
  const role = (value as { role?: unknown }).role;
  return typeof role === "string" ? role : "unknown";
}

function messageFacts(messages: unknown[]): Facts {
  const totals = {
    user: 0,
    assistant: 0,
    toolResult: 0,
    summary: 0,
    other: 0,
  };
  let toolResultBytes = 0;
  let largestToolResultBytes = 0;
  let clearedToolResults = 0;
  for (const message of messages) {
    const serialized = jsonText(message);
    const size = Buffer.byteLength(serialized, "utf8");
    const role = roleOf(message);
    if (role === "user") {
      totals.user += size;
    } else if (role === "assistant") {
      totals.assistant += size;
    } else if (role === "toolResult") {
      totals.toolResult += size;
    } else if (role === "branchSummary" || role === "compactionSummary") {
      totals.summary += size;
    } else {
      totals.other += size;
    }
    if (role === "toolResult") {
      toolResultBytes += size;
      largestToolResultBytes = Math.max(largestToolResultBytes, size);
      if (serialized.includes(CLEARED_TOOL_RESULT)) {
        clearedToolResults += 1;
      }
    }
  }
  return {
    messages: messages.length,
    historyBytes: bytes(messages),
    userBytes: totals.user,
    assistantBytes: totals.assistant,
    toolResultBytes,
    largestToolResultBytes,
    summaryBytes: totals.summary,
    otherBytes: totals.other,
    clearedToolResults,
  };
}

function toolFacts(tools: unknown[] | undefined): Facts {
  const entries = (tools ?? []).map((tool) => {
    const value = tool && typeof tool === "object" ? (tool as { name?: unknown }) : undefined;
    return {
      name: typeof value?.name === "string" ? value.name : "unknown",
      size: bytes(tool),
    };
  });
  const largest = entries.toSorted((left, right) => right.size - left.size)[0];
  return {
    tools: entries.length,
    toolSchemaBytes: entries.reduce((sum, entry) => sum + entry.size, 0),
    largestTool: largest?.name ?? "none",
    largestToolBytes: largest?.size ?? 0,
  };
}

function classifyError(error: unknown): string {
  const text = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  if (/missing_identifiers/iu.test(text)) {
    return "missing_identifiers";
  }
  if (/finalized summary failed quality checks|guard.blocked/iu.test(text)) {
    return "guard_blocked";
  }
  if (/timed?\s*out|timeout/iu.test(text)) {
    return "timeout";
  }
  if (/context|token|too large|overflow/iu.test(text)) {
    return "context_overflow";
  }
  return text ? "other" : "none";
}

function latest(events: ContextEvent[], stage: string): ContextEvent | undefined {
  return events.toReversed().find((event) => event.stage === stage);
}

function latestForRun(
  events: ContextEvent[],
  stage: string,
  runHash: string | undefined,
): ContextEvent | undefined {
  return events
    .toReversed()
    .find((event) => event.stage === stage && (!runHash || event.runHash === runHash));
}

function compactionAfter(
  events: ContextEvent[],
  before: ContextEvent | undefined,
): ContextEvent | undefined {
  if (!before) {
    return undefined;
  }
  const beforeIndex = events.lastIndexOf(before);
  return events
    .slice(beforeIndex + 1)
    .toReversed()
    .find(
      (event) => event.stage === "after-compaction" && event.sessionIdHash === before.sessionIdHash,
    );
}

function latestBefore(
  events: ContextEvent[],
  stage: string,
  anchor: ContextEvent | undefined,
): ContextEvent | undefined {
  if (!anchor) {
    return latest(events, stage);
  }
  const anchorIndex = events.lastIndexOf(anchor);
  return events
    .slice(0, anchorIndex)
    .toReversed()
    .find((event) => event.stage === stage && event.sessionIdHash === anchor.sessionIdHash);
}

function fact(
  event: ContextEvent | undefined,
  name: string,
): string | number | boolean | undefined {
  return event?.facts[name];
}

function pct(used: unknown, total: unknown): string {
  return typeof used === "number" && typeof total === "number" && total > 0
    ? `${Math.round((used / total) * 100)}%`
    : "unknown";
}

function breakpointFor(params: {
  model?: ContextEvent;
  input?: ContextEvent;
  output?: ContextEvent;
  ended?: ContextEvent;
  beforeCompaction?: ContextEvent;
  afterCompaction?: ContextEvent;
  transcriptBytes?: number;
  compactionProbe?: CompactionProbeResult;
}): string {
  const budget = fact(params.model, "contextTokenBudget");
  const inputTokens = fact(params.output, "inputTokens");
  if (fact(params.ended, "errorClass") === "missing_identifiers") {
    return "COMPACTION_MISSING_IDENTIFIERS";
  }
  if (fact(params.ended, "errorClass") === "guard_blocked") {
    return "COMPACTION_QUALITY_GUARD";
  }
  if (params.compactionProbe && !params.compactionProbe.compacted) {
    return classifyError(params.compactionProbe.reason) === "guard_blocked"
      ? "COMPACTION_QUALITY_GUARD"
      : "COMPACTION_PROBE_FAILED";
  }
  if (!params.input) {
    return "LLM_INPUT_NOT_OBSERVED";
  }
  if (params.beforeCompaction && !params.afterCompaction) {
    return "COMPACTION_STARTED_WITHOUT_SUCCESS";
  }
  if (typeof inputTokens === "number" && typeof budget === "number" && inputTokens >= budget) {
    return "MODEL_CONTEXT_EXHAUSTED";
  }
  const fixedBytes =
    Number(fact(params.input, "systemPromptBytes") ?? 0) +
    Number(fact(params.input, "toolSchemaBytes") ?? 0);
  const historyBytes = Number(fact(params.input, "historyBytes") ?? 0);
  if (fixedBytes > historyBytes && fixedBytes > (params.transcriptBytes ?? 0)) {
    return "FIXED_CONTEXT_DOMINATES";
  }
  if (Number(fact(params.input, "toolResultBytes") ?? 0) > fixedBytes) {
    return "TOOL_RESULTS_DOMINATE";
  }
  return "NO_FAILURE_CAPTURED";
}

export class SgContextDiagnostics {
  private readonly instanceId = randomUUID().slice(0, 8);
  private readonly directory: string;
  private readonly file: string;
  private events: ContextEvent[] = [];
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    stateDir: string,
    private readonly api: DiagnosticApi,
  ) {
    this.directory = path.join(stateDir, "sg", "diagnostics");
    this.file = path.join(
      this.directory,
      `context-${Date.now()}-${process.pid}-${this.instanceId}.json`,
    );
  }

  private record(
    stage: string,
    identity: { sessionKey?: string; sessionId?: string; runId?: string },
    facts: Facts = {},
  ): void {
    this.events.push({
      version: 1,
      recordedAt: new Date().toISOString(),
      instanceId: this.instanceId,
      stage,
      sessionHash: hash(identity.sessionKey),
      sessionIdHash: hash(identity.sessionId),
      runHash: hash(identity.runId),
      facts,
    });
    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
    }
    this.writeQueue = this.writeQueue
      .then(async () => {
        await mkdir(this.directory, { recursive: true });
        const temporary = `${this.file}.tmp`;
        await writeFile(temporary, JSON.stringify(this.events), "utf8");
        await rename(temporary, this.file);
      })
      .catch((error: unknown) => {
        this.api.logger?.warn(`[sg-context-diag] write failed: ${String(error)}`);
      });
  }

  register(): void {
    this.api.on("before_reset", (event, ctx) => {
      this.record("before-reset", ctx, {
        reason: event.reason ?? "unknown",
        ...messageFacts(Array.isArray(event.messages) ? event.messages : []),
      });
    });
    this.api.on("session_start", (event, ctx) => {
      this.record(
        "session-start",
        { ...ctx, sessionKey: event.sessionKey ?? ctx.sessionKey },
        {
          resumed: Boolean(event.resumedFrom),
        },
      );
    });
    this.api.on("session_end", (event, ctx) => {
      this.record(
        "session-end",
        { ...ctx, sessionKey: event.sessionKey ?? ctx.sessionKey },
        {
          reason: event.reason ?? "unknown",
          messages: event.messageCount,
          nextSession: event.nextSessionId ? hash(event.nextSessionId) : "none",
        },
      );
    });
    this.api.on("before_prompt_build", (event, ctx) => {
      this.record("prompt-build", ctx, {
        promptBytes: bytes(event.prompt),
        ...messageFacts(event.messages),
      });
    });
    this.api.on("llm_input", (event, ctx) => {
      this.record(
        "llm-input",
        { ...ctx, runId: event.runId, sessionId: event.sessionId },
        {
          provider: event.provider,
          model: event.model,
          systemPromptBytes: bytes(event.systemPrompt),
          promptBytes: bytes(event.prompt),
          ...messageFacts(event.historyMessages),
          ...toolFacts(event.tools),
        },
      );
    });
    this.api.on("model_call_started", (event, ctx) => {
      this.record(
        "model-call",
        { ...ctx, runId: event.runId, sessionId: event.sessionId ?? ctx.sessionId },
        {
          provider: event.provider,
          model: event.model,
          contextTokenBudget: event.contextTokenBudget ?? 0,
          contextWindowSource: event.contextWindowSource ?? "unknown",
          contextWindowReferenceTokens: event.contextWindowReferenceTokens ?? 0,
        },
      );
    });
    this.api.on("model_call_ended", (event, ctx) => {
      this.record(
        "model-ended",
        { ...ctx, runId: event.runId },
        {
          outcome: event.outcome,
          errorCategory: event.errorCategory ?? "none",
          failureKind: event.failureKind ?? "none",
          requestPayloadBytes: event.requestPayloadBytes ?? 0,
          durationMs: event.durationMs,
        },
      );
    });
    this.api.on("llm_output", (event, ctx) => {
      this.record(
        "llm-output",
        { ...ctx, runId: event.runId, sessionId: event.sessionId },
        {
          provider: event.provider,
          model: event.model,
          contextTokenBudget: event.contextTokenBudget ?? 0,
          inputTokens: event.usage?.input ?? 0,
          outputTokens: event.usage?.output ?? 0,
          cacheReadTokens: event.usage?.cacheRead ?? 0,
        },
      );
    });
    this.api.on("reply_payload_sending", (event, ctx) => {
      this.record(
        "reply-usage",
        { ...ctx, runId: event.runId },
        {
          contextUsedTokens: event.usageState?.contextUsedTokens ?? 0,
          contextTokenBudget: event.usageState?.contextTokenBudget ?? 0,
          compactionCount: event.usageState?.compactionCount ?? 0,
        },
      );
    });
    this.api.on("tool_result_persist", (event, ctx) => {
      this.record("tool-result", ctx, {
        tool: event.toolName ?? ctx.toolName ?? "unknown",
        bytes: bytes(event.message),
        synthetic: event.isSynthetic ?? false,
      });
    });
    this.api.on("before_compaction", (event, ctx) => {
      this.record("before-compaction", ctx, {
        messages: event.messageCount,
        compacting: event.compactingCount ?? 0,
        tokens: event.tokenCount ?? 0,
      });
    });
    this.api.on("after_compaction", (event, ctx) => {
      this.record("after-compaction", ctx, {
        messages: event.messageCount,
        compacted: event.compactedCount,
        tokens: event.tokenCount ?? 0,
      });
    });
    this.api.on("agent_end", (event, ctx) => {
      this.record(
        "agent-end",
        { ...ctx, runId: event.runId },
        {
          success: event.success,
          errorClass: classifyError(event.error),
          messages: event.messages.length,
        },
      );
    });
  }

  private async readEvents(sessionKey?: string): Promise<ContextEvent[]> {
    await this.writeQueue;
    let files: string[] = [];
    try {
      const candidates = (await readdir(this.directory)).filter(
        (file) => file.startsWith("context-") && file.endsWith(".json"),
      );
      const dated = await Promise.all(
        candidates.map(async (file) => ({
          file,
          modifiedAt: (await stat(path.join(this.directory, file))).mtimeMs,
        })),
      );
      files = dated
        .toSorted((left, right) => right.modifiedAt - left.modifiedAt)
        .slice(0, MAX_INSTANCE_FILES)
        .map((entry) => entry.file);
    } catch {
      return [];
    }
    const snapshots = await Promise.all(
      files.map(async (file) => {
        try {
          const parsed: unknown = JSON.parse(
            await readFile(path.join(this.directory, file), "utf8"),
          );
          return Array.isArray(parsed)
            ? parsed.filter(
                (event): event is ContextEvent =>
                  Boolean(event) &&
                  typeof event === "object" &&
                  (event as { version?: unknown }).version === 1,
              )
            : [];
        } catch {
          return [];
        }
      }),
    );
    const sessionHash = hash(sessionKey);
    return snapshots
      .flat()
      .filter((event) => event.sessionHash === sessionHash)
      .toSorted((left, right) => Date.parse(left.recordedAt) - Date.parse(right.recordedAt));
  }

  async report(command: SgContextDiagnosticCommand): Promise<string> {
    const compactRequested = command.args?.trim().toLowerCase() === "compact";
    let transcriptMessages: unknown[] = [];
    let transcriptError = "none";
    if (command.sessionTarget) {
      try {
        const { readVisibleSessionTranscriptMessageEntries } =
          await import("openclaw/plugin-sdk/session-transcript-runtime");
        const entries = await readVisibleSessionTranscriptMessageEntries(command.sessionTarget);
        transcriptMessages = entries.map((entry) => entry.message);
      } catch (error) {
        transcriptError = classifyError(error);
      }
    } else {
      transcriptError = "session_target_missing";
    }
    const transcript = messageFacts(transcriptMessages);
    let compactionProbe: CompactionProbeResult | undefined;
    if (compactRequested) {
      compactionProbe = await command.runtimeContext?.compactCurrent?.();
    }
    const events = await this.readEvents(command.sessionKey);
    const reset = latest(events, "before-reset");
    const start = latest(events, "session-start");
    const input = latest(events, "llm-input");
    const promptBuild = latestBefore(events, "prompt-build", input);
    const runHash = input?.runHash;
    const model = latestForRun(events, "model-call", runHash);
    const output = latestForRun(events, "llm-output", runHash);
    const usage = latestForRun(events, "reply-usage", runHash);
    const beforeCompaction = latest(events, "before-compaction");
    const afterCompaction = compactionAfter(events, beforeCompaction);
    const ended = latestForRun(events, "agent-end", runHash);
    const pruning = command.config.agents?.defaults?.contextPruning;
    const historyBytes = Number(fact(input, "historyBytes") ?? 0);
    const promptBuildHistoryBytes = Number(fact(promptBuild, "historyBytes") ?? 0);
    const transcriptBytes = Number(transcript.historyBytes ?? 0);
    const postBuildHistoryDelta = Math.max(0, historyBytes - promptBuildHistoryBytes);
    const contextBudget = fact(model, "contextTokenBudget") ?? fact(usage, "contextTokenBudget");
    const contextUsed = fact(usage, "contextUsedTokens") ?? fact(output, "inputTokens");
    const breakpoint = breakpointFor({
      model,
      input,
      output,
      ended,
      beforeCompaction,
      afterCompaction,
      transcriptBytes,
      compactionProbe,
    });
    const status =
      breakpoint === "NO_FAILURE_CAPTURED"
        ? "PASS"
        : breakpoint === "FIXED_CONTEXT_DOMINATES" || breakpoint === "TOOL_RESULTS_DOMINATE"
          ? "WARN"
          : "FAIL";
    const probeReason = compactionProbe?.reason?.replace(/\s+/gu, " ").slice(0, 200) ?? "none";
    const probeText = !compactRequested
      ? "NOT_RUN (use /sg_context_diag compact)"
      : compactionProbe
        ? `${compactionProbe.compacted ? "OK" : "FAIL"} (${compactionProbe.tokensBefore ?? "?"} -> ${compactionProbe.tokensAfter ?? "?"}; ${probeReason})`
        : "UNAVAILABLE";
    return [
      `SG CONTEXT DIAG — ${status}`,
      `diagnostic_version: ${DIAGNOSTIC_VERSION}`,
      `image_commit: ${process.env.SG22_IMAGE_COMMIT?.trim() || "unknown"}`,
      `session: key=${hash(command.sessionKey)}, id=${hash(command.sessionId)}`,
      `reset: ${reset ? `OBSERVED (reason=${fact(reset, "reason")})` : "NOT_OBSERVED"}`,
      `session_start: ${start ? (start.sessionIdHash === hash(command.sessionId) ? "OBSERVED" : "MISMATCH") : "NOT_OBSERVED"}`,
      `model: ${fact(model, "provider") ?? fact(input, "provider") ?? "unknown"}/${fact(model, "model") ?? fact(input, "model") ?? "unknown"}`,
      `context_window: ${contextBudget ?? "unknown"} tokens (source=${fact(model, "contextWindowSource") ?? "unknown"})`,
      `actual_context: ${contextUsed ?? "unknown"}/${contextBudget ?? "unknown"} (${pct(contextUsed, contextBudget)})`,
      `system_prompt: ${fact(input, "systemPromptBytes") ?? "unknown"} bytes`,
      `tool_schemas: ${fact(input, "toolSchemaBytes") ?? "unknown"} bytes (${fact(input, "tools") ?? "?"} tools; largest=${fact(input, "largestTool") ?? "?"}:${fact(input, "largestToolBytes") ?? "?"})`,
      `prompt_build: ${fact(promptBuild, "promptBytes") ?? "unknown"} bytes; history=${fact(promptBuild, "historyBytes") ?? "unknown"}`,
      `history: ${historyBytes || "unknown"} bytes (${fact(input, "messages") ?? "?"} messages)`,
      `transcript: ${transcriptError === "none" ? `${transcriptBytes} bytes (${transcript.messages} messages)` : `UNKNOWN (${transcriptError})`}`,
      `history_delta_after_prompt_build: ${promptBuild && input ? `${postBuildHistoryDelta} bytes` : "unknown"}`,
      "memory_attribution: INCLUDED_IN_PROMPT; exact component size is not exposed by plugin API",
      `tool_results: ${fact(input, "toolResultBytes") ?? "unknown"} bytes (largest=${fact(input, "largestToolResultBytes") ?? "?"})`,
      `pruning: mode=${pruning?.mode ?? "unset"}, ttl=${pruning?.ttl ?? "unset"}, cleared=${fact(input, "clearedToolResults") ?? "unknown"}`,
      `compaction_before: ${beforeCompaction ? `OBSERVED (${fact(beforeCompaction, "tokens") ?? "?"} tokens)` : "NOT_OBSERVED"}`,
      `compaction_after: ${afterCompaction ? `SUCCESS (${fact(afterCompaction, "tokens") ?? "?"} tokens)` : "NOT_OBSERVED"}`,
      `last_error: ${fact(ended, "errorClass") ?? "none"}`,
      `compaction_probe: ${probeText}`,
      `breakpoint: ${breakpoint}`,
      `events: ${events.length}`,
    ].join("\n");
  }
}
