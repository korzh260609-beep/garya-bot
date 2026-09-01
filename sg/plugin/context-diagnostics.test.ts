import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SgContextDiagnostics } from "./context-diagnostics.js";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-context-diag-"));
  const hooks = new Map<string, (event: any, ctx: any) => unknown>();
  const api = {
    on: vi.fn((name: string, handler: (event: any, ctx: any) => unknown) => {
      hooks.set(name, handler);
    }),
    logger: { warn: vi.fn() },
  };
  const diagnostics = new SgContextDiagnostics(root, api as never);
  diagnostics.register();
  const identity = {
    sessionKey: "agent:main:telegram:direct:100",
    sessionId: "session-1",
    runId: "run-1",
  };
  return { diagnostics, hooks, identity };
}

const config = {
  agents: {
    defaults: {
      contextPruning: { mode: "cache-ttl", ttl: "5m", hardClear: { enabled: true } },
    },
  },
};

describe("SG context end-to-end diagnostics", () => {
  it("records reset, model budget, prompt components, usage, pruning, and compaction", async () => {
    const { diagnostics, hooks, identity } = await fixture();
    await hooks.get("before_reset")?.({ reason: "new", messages: [] }, identity);
    await hooks.get("session_start")?.(
      { sessionId: identity.sessionId, sessionKey: identity.sessionKey },
      identity,
    );
    await hooks.get("before_prompt_build")?.(
      { prompt: "hello", messages: [{ role: "user", content: "hello" }] },
      identity,
    );
    await hooks.get("llm_input")?.(
      {
        ...identity,
        provider: "openai",
        model: "gpt-5.4-mini",
        systemPrompt: "s".repeat(900),
        prompt: "hello",
        historyMessages: [{ role: "user", content: "hello" }],
        tools: [{ name: "large_tool", parameters: { text: "x".repeat(300) } }],
      },
      identity,
    );
    await hooks.get("model_call_started")?.(
      {
        ...identity,
        callId: "call-1",
        provider: "openai",
        model: "gpt-5.4-mini",
        contextTokenBudget: 128_000,
        contextWindowSource: "model",
      },
      identity,
    );
    await hooks.get("llm_output")?.(
      {
        ...identity,
        provider: "openai",
        model: "gpt-5.4-mini",
        assistantTexts: [],
        usage: { input: 90_000, output: 10 },
      },
      identity,
    );
    await hooks.get("before_compaction")?.({ messageCount: 8, tokenCount: 90_000 }, identity);
    await hooks.get("after_compaction")?.(
      { messageCount: 4, compactedCount: 4, tokenCount: 30_000 },
      identity,
    );

    const result = await diagnostics.report({ ...identity, config });
    expect(result).toContain("reset: OBSERVED (reason=new)");
    expect(result).toContain("model: openai/gpt-5.4-mini");
    expect(result).toContain("context_window: 128000 tokens (source=model)");
    expect(result).toContain("system_prompt: 900 bytes");
    expect(result).toContain("largest=large_tool");
    expect(result).toContain("prompt_build: 5 bytes");
    expect(result).toContain("pruning: mode=cache-ttl, ttl=5m");
    expect(result).toContain("compaction_after: SUCCESS (30000 tokens)");
  });

  it("identifies the quality-guard failure seen in Render logs", async () => {
    const { diagnostics, hooks, identity } = await fixture();
    await hooks.get("llm_input")?.(
      {
        ...identity,
        provider: "openai",
        model: "gpt-5.4-mini",
        prompt: "hello",
        historyMessages: [],
        tools: [],
      },
      identity,
    );
    await hooks.get("before_compaction")?.({ messageCount: 5, tokenCount: 128_001 }, identity);
    await hooks.get("agent_end")?.(
      {
        runId: identity.runId,
        messages: [],
        success: false,
        error: "Compaction safeguard finalized summary failed quality checks.",
      },
      identity,
    );

    const result = await diagnostics.report({ ...identity, config });
    expect(result).toContain("last_error: guard_blocked");
    expect(result).toContain("compaction_after: NOT_OBSERVED");
    expect(result).toContain("breakpoint: COMPACTION_QUALITY_GUARD");
  });

  it("does not let an older successful compaction mask a newer failed attempt", async () => {
    const { diagnostics, hooks, identity } = await fixture();
    await hooks.get("llm_input")?.(
      {
        ...identity,
        provider: "openai",
        model: "gpt-5.4-mini",
        prompt: "hello",
        historyMessages: [],
        tools: [],
      },
      identity,
    );
    await hooks.get("before_compaction")?.({ messageCount: 9, tokenCount: 90_000 }, identity);
    await hooks.get("after_compaction")?.(
      { messageCount: 5, compactedCount: 4, tokenCount: 30_000 },
      identity,
    );
    await hooks.get("before_compaction")?.({ messageCount: 8, tokenCount: 128_001 }, identity);

    const result = await diagnostics.report({ ...identity, config });
    expect(result).toContain("compaction_before: OBSERVED (128001 tokens)");
    expect(result).toContain("compaction_after: NOT_OBSERVED");
    expect(result).toContain("breakpoint: COMPACTION_STARTED_WITHOUT_SUCCESS");
  });

  it("runs a controlled compaction only with the explicit compact argument", async () => {
    const { diagnostics, identity } = await fixture();
    const compactCurrent = vi.fn(async () => ({
      compacted: false,
      reason: "Compaction safeguard finalized summary failed quality checks.",
      tokensBefore: 128_001,
      tokensAfter: 128_001,
    }));
    const passive = await diagnostics.report({
      ...identity,
      config,
      runtimeContext: { compactCurrent },
    });
    expect(compactCurrent).not.toHaveBeenCalled();
    expect(passive).toContain("compaction_probe: NOT_RUN");

    const active = await diagnostics.report({
      ...identity,
      args: "compact",
      config,
      runtimeContext: { compactCurrent },
    });
    expect(compactCurrent).toHaveBeenCalledOnce();
    expect(active).toContain("compaction_probe: FAIL (128001 -> 128001");
    expect(active).toContain("breakpoint: COMPACTION_QUALITY_GUARD");
  });
});
