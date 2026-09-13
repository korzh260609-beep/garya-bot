// Covers wired plugin hooks around LLM request handling.
import { describe, expect, it, vi } from "vitest";
import { createHookRunnerWithRegistry } from "./hooks.test-fixtures.js";

const hookCtx = {
  agentId: "main",
  sessionId: "session-1",
};

async function expectLlmHookCall(params: {
  hookName: "model_call_started" | "model_call_ended" | "llm_input" | "llm_output";
  event: Record<string, unknown>;
}) {
  const handler = vi.fn();
  const { runner } = createHookRunnerWithRegistry([{ hookName: params.hookName, handler }]);
  let expectedEvent: Record<string, unknown> = params.event;

  if (params.hookName === "model_call_started") {
    await runner.runModelCallStarted(
      params.event as Parameters<typeof runner.runModelCallStarted>[0],
      hookCtx,
    );
  } else if (params.hookName === "model_call_ended") {
    await runner.runModelCallEnded(
      params.event as Parameters<typeof runner.runModelCallEnded>[0],
      hookCtx,
    );
  } else if (params.hookName === "llm_input") {
    await runner.runLlmInput(
      {
        ...params.event,
        historyMessages: [...((params.event.historyMessages as unknown[] | undefined) ?? [])],
      } as Parameters<typeof runner.runLlmInput>[0],
      hookCtx,
    );
    expectedEvent = {
      ...params.event,
      historyMessages: [...((params.event.historyMessages as unknown[] | undefined) ?? [])],
    };
  } else {
    await runner.runLlmOutput(
      {
        ...params.event,
        assistantTexts: [...((params.event.assistantTexts as string[] | undefined) ?? [])],
      } as Parameters<typeof runner.runLlmOutput>[0],
      hookCtx,
    );
    expectedEvent = {
      ...params.event,
      assistantTexts: [...((params.event.assistantTexts as string[] | undefined) ?? [])],
    };
  }

  expect(handler).toHaveBeenCalledWith(expectedEvent, hookCtx);
}

describe("llm hook runner methods", () => {
  it("merges model-call limits conservatively and stops on a block", async () => {
    const first = vi.fn(() => ({ maxOutputTokens: 200 }));
    const second = vi.fn(() => ({ maxOutputTokens: 80, maxRetries: 0 }));
    const blocker = vi.fn(() => ({ block: true, blockReason: "budget exhausted" }));
    const skipped = vi.fn(() => ({ maxOutputTokens: 1 }));
    const { runner } = createHookRunnerWithRegistry([
      { hookName: "before_model_call", handler: first },
      { hookName: "before_model_call", handler: second },
      { hookName: "before_model_call", handler: blocker },
      { hookName: "before_model_call", handler: skipped },
    ]);
    const event = {
      runId: "run-1",
      callId: "call-1",
      provider: "openai",
      model: "gpt-5",
      maxOutputTokens: 400,
      inputUpperBoundTokens: 8_000,
      cost: { input: 1, output: 2, cacheRead: 0.5, cacheWrite: 1.25 },
    };

    await expect(runner.runBeforeModelCall(event, hookCtx)).resolves.toEqual({
      block: true,
      blockReason: "budget exhausted",
      maxOutputTokens: 80,
      maxRetries: 0,
    });
    expect(skipped).not.toHaveBeenCalled();
  });

  it("stops billable provider authorization on the first blocking hook", async () => {
    const allow = vi.fn(() => ({ block: false }));
    const blocker = vi.fn(() => ({ block: true, blockReason: "upper bound unavailable" }));
    const skipped = vi.fn(() => ({ block: false }));
    const { runner } = createHookRunnerWithRegistry([
      { hookName: "before_billable_operation", handler: allow },
      { hookName: "before_billable_operation", handler: blocker },
      { hookName: "before_billable_operation", handler: skipped },
    ]);
    const event = {
      runId: "run-video-1",
      toolCallId: "call-video-1",
      provider: "openrouter",
      model: "google/veo-3.1",
      category: "video_generation",
      costUpperBound: { totalUsd: 0.5, evidence: "catalog-upper-bound" as const },
    };

    await expect(runner.runBeforeBillableOperation(event, hookCtx)).resolves.toEqual({
      block: true,
      blockReason: "upper bound unavailable",
    });
    expect(skipped).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "runModelCallStarted invokes registered model_call_started hooks",
      hookName: "model_call_started" as const,
      methodName: "runModelCallStarted" as const,
      event: {
        runId: "run-1",
        callId: "call-1",
        sessionId: "session-1",
        provider: "openai",
        model: "gpt-5",
        api: "openai-responses",
        transport: "http",
      },
    },
    {
      name: "runModelCallEnded invokes registered model_call_ended hooks",
      hookName: "model_call_ended" as const,
      methodName: "runModelCallEnded" as const,
      event: {
        runId: "run-1",
        callId: "call-1",
        sessionId: "session-1",
        provider: "openai",
        model: "gpt-5",
        durationMs: 42,
        outcome: "error",
        errorCategory: "TimeoutError",
        upstreamRequestIdHash: "sha256:abcdef123456",
      },
    },
    {
      name: "runLlmInput invokes registered llm_input hooks",
      hookName: "llm_input" as const,
      methodName: "runLlmInput" as const,
      event: {
        runId: "run-1",
        sessionId: "session-1",
        provider: "openai",
        model: "gpt-5",
        systemPrompt: "be helpful",
        prompt: "hello",
        historyMessages: [],
        imagesCount: 0,
        tools: [],
      },
    },
    {
      name: "runLlmOutput invokes registered llm_output hooks",
      hookName: "llm_output" as const,
      methodName: "runLlmOutput" as const,
      event: {
        runId: "run-1",
        sessionId: "session-1",
        provider: "openai",
        model: "gpt-5",
        assistantTexts: ["hi"],
        lastAssistant: { role: "assistant", content: "hi" },
        usage: {
          input: 10,
          output: 20,
          total: 30,
        },
      },
    },
  ] as const)("$name", async ({ hookName, event }) => {
    await expectLlmHookCall({ hookName, event });
  });

  it("hasHooks returns true for registered llm hooks", () => {
    const { runner } = createHookRunnerWithRegistry([
      { hookName: "model_call_started", handler: vi.fn() },
      { hookName: "llm_input", handler: vi.fn() },
    ]);

    expect(runner.hasHooks("model_call_started")).toBe(true);
    expect(runner.hasHooks("before_model_call")).toBe(false);
    expect(runner.hasHooks("model_call_ended")).toBe(false);
    expect(runner.hasHooks("llm_input")).toBe(true);
    expect(runner.hasHooks("llm_output")).toBe(false);
  });

  it("runs generic billable operation completion hooks", async () => {
    const handler = vi.fn();
    const { runner } = createHookRunnerWithRegistry([
      { hookName: "billable_operation_completed", handler },
    ]);
    const event = {
      runId: "run-image-1",
      toolCallId: "call-image-1",
      provider: "openai",
      model: "gpt-image-1.5",
      category: "image_generation",
      outcome: "completed" as const,
      quantity: 1,
      unit: "images",
      dimensions: { size: "1024x1024", quality: "high" },
      cost: { totalUsd: 0.08, evidence: "provider-billed" as const },
      usage: { input: 12, output: 34, total: 46 },
    };

    await runner.runBillableOperationCompleted(event, hookCtx);

    expect(handler).toHaveBeenCalledWith(event, hookCtx);
  });
});
