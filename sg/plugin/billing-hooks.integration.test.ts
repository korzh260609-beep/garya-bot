import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SgBillingLedger, usdToNanoUsd } from "./billing-ledger.js";
import { registerWorkspaceManager } from "./register.js";

type RegisteredHook = (event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown;

const roots: string[] = [];
const timestamp = "2026-01-01T00:00:00.000Z";

async function createStateDir() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-billing-hooks-"));
  roots.push(root);
  const profilePath = path.join(root, "sg", "global-profiles.json");
  await mkdir(path.dirname(profilePath), { recursive: true });
  await writeFile(
    profilePath,
    JSON.stringify({
      version: 5,
      monarchGlobalId: "usr_monarch",
      profiles: [
        {
          globalId: "usr_monarch",
          canonicalIdentity: "channel:telegram:100",
          role: "monarch",
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          globalId: "usr_citizen",
          canonicalIdentity: "channel:telegram:200",
          role: "citizen",
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      identities: [
        {
          canonicalIdentity: "channel:telegram:100",
          globalId: "usr_monarch",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          canonicalIdentity: "channel:telegram:200",
          globalId: "usr_citizen",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    }),
  );
  return root;
}

async function credit(root: string, amountNanoUsd: number) {
  const ledger = new SgBillingLedger(root);
  try {
    await ledger.credit({
      globalId: "usr_citizen",
      creditId: `test-credit:${amountNanoUsd}`,
      amountNanoUsd,
    });
  } finally {
    ledger.close();
  }
}

async function snapshot(root: string) {
  const ledger = new SgBillingLedger(root);
  try {
    return await ledger.snapshot("usr_citizen");
  } finally {
    ledger.close();
  }
}

function register(root: string) {
  const hooks = new Map<string, RegisteredHook[]>();
  const warn = vi.fn();
  registerWorkspaceManager({
    registerCommand: vi.fn(),
    registerTool: vi.fn(),
    on: vi.fn((name, handler) => {
      const registered = hooks.get(name) ?? [];
      registered.push(handler as RegisteredHook);
      hooks.set(name, registered);
    }),
    logger: { info: vi.fn(), warn },
    runtime: { state: { resolveStateDir: () => root } },
  });
  return { hooks, warn };
}

async function runHooks(
  hooks: Map<string, RegisteredHook[]>,
  name: string,
  event: Record<string, unknown>,
  ctx: Record<string, unknown>,
) {
  const results: unknown[] = [];
  for (const hook of hooks.get(name) ?? []) {
    results.push(await hook(event, ctx));
  }
  return results;
}

const agentContext = (runId: string) => ({
  runId,
  agentId: "main",
  sessionId: "session-citizen",
  sessionKey: "agent:main:telegram:direct:200",
  channel: "telegram",
  chatId: "telegram:200",
  channelId: "200",
  senderId: "200",
  modelProviderId: "openai",
  modelId: "gpt-5.6-terra",
  contextTokenBudget: 128_000,
});

const beforeRunEvent = {
  prompt: "Привет",
  messages: [],
  channelId: "200",
  senderId: "200",
};

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 })),
  );
});

describe("SG billing hook integration contract", () => {
  it("registers the native blocking and terminal billing hooks", async () => {
    const root = await createStateDir();
    const { hooks } = register(root);

    expect(hooks.has("before_agent_run")).toBe(true);
    expect(hooks.has("before_model_call")).toBe(true);
    expect(hooks.has("before_billable_operation")).toBe(true);
    expect(hooks.has("before_tool_call")).toBe(true);
    expect(hooks.has("model_call_ended")).toBe(true);
    expect(hooks.has("billable_operation_completed")).toBe(true);
    expect(hooks.has("agent_end")).toBe(true);
    expect(hooks.has("gateway_stop")).toBe(true);
  });

  it("passes the monarch when OpenClaw exposes the conversation id as channelId", async () => {
    const root = await createStateDir();
    const { hooks } = register(root);
    const ctx = {
      ...agentContext("run-monarch"),
      sessionId: "session-monarch",
      sessionKey: "agent:main:telegram:direct:100",
      chatId: "telegram:100",
      channelId: "100",
      senderId: "100",
    };

    const results = await runHooks(
      hooks,
      "before_agent_run",
      { ...beforeRunEvent, channelId: "100", senderId: "100" },
      ctx,
    );

    expect(results).toContainEqual({ outcome: "pass" });
  });

  it("blocks a citizen before inference when prepaid funds are insufficient", async () => {
    const root = await createStateDir();
    const { hooks } = register(root);

    const results = await runHooks(
      hooks,
      "before_agent_run",
      beforeRunEvent,
      agentContext("run-insufficient"),
    );

    expect(results).toContainEqual(
      expect.objectContaining({
        outcome: "block",
        category: "cost_limit",
      }),
    );
    await expect(snapshot(root)).resolves.toEqual({
      balanceNanoUsd: 0,
      reservedNanoUsd: 0,
      availableNanoUsd: 0,
    });
  });

  it("reserves a positive run budget before inference and passes the request", async () => {
    const root = await createStateDir();
    await credit(root, usdToNanoUsd(1));
    const { hooks } = register(root);

    const results = await runHooks(
      hooks,
      "before_agent_run",
      beforeRunEvent,
      agentContext("run-reserved"),
    );
    const account = await snapshot(root);

    expect(results).toContainEqual({ outcome: "pass" });
    expect(account.reservedNanoUsd).toBeGreaterThan(0);
    expect(account.availableNanoUsd).toBe(account.balanceNanoUsd - account.reservedNanoUsd);
  });

  it("aggregates every provider-billed model call, charges times two, and releases the remainder", async () => {
    const root = await createStateDir();
    const openingBalance = usdToNanoUsd(1);
    await credit(root, openingBalance);
    const { hooks } = register(root);
    const ctx = agentContext("run-multiple-calls");
    await runHooks(hooks, "before_agent_run", beforeRunEvent, ctx);

    await runHooks(
      hooks,
      "model_call_ended",
      {
        runId: "run-multiple-calls",
        callId: "call-one",
        provider: "openai",
        model: "gpt-5.6-terra",
        durationMs: 10,
        outcome: "completed",
        usage: { cost: { total: 0.0001, totalOrigin: "provider-billed" } },
      },
      ctx,
    );
    await runHooks(
      hooks,
      "model_call_ended",
      {
        runId: "run-multiple-calls",
        callId: "call-two",
        provider: "openai",
        model: "gpt-5.6-terra",
        durationMs: 10,
        outcome: "error",
        usage: { cost: { total: 0.00005, totalOrigin: "provider-billed" } },
      },
      ctx,
    );
    await runHooks(
      hooks,
      "agent_end",
      { messages: [], success: false, error: "provider error", durationMs: 30 },
      ctx,
    );

    await expect(snapshot(root)).resolves.toEqual({
      balanceNanoUsd: openingBalance - usdToNanoUsd(0.00015) * 2,
      reservedNanoUsd: 0,
      availableNanoUsd: openingBalance - usdToNanoUsd(0.00015) * 2,
    });
  });

  it("authorizes a bounded model call and denies concurrent spend beyond prepaid funds", async () => {
    const root = await createStateDir();
    await credit(root, usdToNanoUsd(0.01));
    const { hooks } = register(root);
    const ctx = agentContext("run-hard-limit");
    await runHooks(hooks, "before_agent_run", beforeRunEvent, ctx);
    const request = {
      runId: "run-hard-limit",
      callId: "call-first",
      provider: "openai",
      model: "gpt-5.6-terra",
      maxOutputTokens: 1_000,
      inputUpperBoundTokens: 1_000,
      cost: { input: 2, output: 12, cacheRead: 0.2, cacheWrite: 2.5 },
    };

    const first = await runHooks(hooks, "before_model_call", request, ctx);
    const second = await runHooks(
      hooks,
      "before_model_call",
      { ...request, callId: "call-second" },
      ctx,
    );

    expect(first).toContainEqual({ maxOutputTokens: 83, maxRetries: 0 });
    expect(second).toContainEqual(
      expect.objectContaining({
        block: true,
        blockReason: expect.stringContaining("cannot cover"),
      }),
    );
  });

  it("does not charge a duplicated model terminal event twice", async () => {
    const root = await createStateDir();
    const openingBalance = usdToNanoUsd(1);
    await credit(root, openingBalance);
    const { hooks } = register(root);
    const ctx = agentContext("run-duplicate-call");
    await runHooks(hooks, "before_agent_run", beforeRunEvent, ctx);
    const terminal = {
      runId: "run-duplicate-call",
      callId: "call-duplicate",
      provider: "openai",
      model: "gpt-5.6-terra",
      durationMs: 10,
      outcome: "completed",
      usage: { cost: { total: 0.0001, totalOrigin: "provider-billed" } },
    };

    await runHooks(hooks, "model_call_ended", terminal, ctx);
    await runHooks(hooks, "model_call_ended", terminal, ctx);
    await runHooks(hooks, "agent_end", { messages: [], success: true, durationMs: 30 }, ctx);

    expect((await snapshot(root)).balanceNanoUsd).toBe(openingBalance - usdToNanoUsd(0.0001) * 2);
  });

  it("keeps the run reserved when exact provider cost is missing", async () => {
    const root = await createStateDir();
    await credit(root, usdToNanoUsd(1));
    const { hooks, warn } = register(root);
    const ctx = agentContext("run-cost-missing");
    await runHooks(hooks, "before_agent_run", beforeRunEvent, ctx);

    await runHooks(
      hooks,
      "model_call_ended",
      {
        runId: "run-cost-missing",
        callId: "call-cost-missing",
        provider: "openai",
        model: "gpt-5.6-terra",
        durationMs: 10,
        outcome: "completed",
        usage: { input: 100, output: 20 },
      },
      ctx,
    );
    await runHooks(hooks, "agent_end", { messages: [], success: true, durationMs: 30 }, ctx);

    expect((await snapshot(root)).reservedNanoUsd).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("provider cost unavailable"));
  });

  it("reserves media before the tool call and never treats an unpriced terminal as free", async () => {
    const root = await createStateDir();
    await credit(root, usdToNanoUsd(1));
    const { hooks } = register(root);
    const ctx = {
      ...agentContext("run-media"),
      toolName: "image_generate",
      toolCallId: "tool-image-one",
      requester: { channel: "telegram", accountId: "default", senderId: "200" },
    };

    const results = await runHooks(
      hooks,
      "before_tool_call",
      {
        toolName: "image_generate",
        params: { size: "1024x1024", quality: "high" },
        runId: "run-media",
        toolCallId: "tool-image-one",
      },
      ctx,
    );
    const afterReserve = await snapshot(root);
    expect(results).not.toContainEqual(expect.objectContaining({ block: true }));
    expect(afterReserve.reservedNanoUsd).toBeGreaterThan(0);

    await runHooks(
      hooks,
      "billable_operation_completed",
      {
        runId: "run-media",
        toolCallId: "tool-image-one",
        provider: "openai",
        model: "gpt-image-1.5",
        category: "image_generation",
        outcome: "completed",
        quantity: 1,
        unit: "images",
        dimensions: { size: "1024x1024", quality: "high" },
      },
      { runId: "run-media", sessionKey: ctx.sessionKey },
    );

    expect((await snapshot(root)).reservedNanoUsd).toBe(afterReserve.reservedNanoUsd);
  });

  it("blocks media before provider I/O when a catalog upper bound is unavailable", async () => {
    const root = await createStateDir();
    await credit(root, usdToNanoUsd(1));
    const { hooks } = register(root);
    const ctx = {
      ...agentContext("run-unbounded-media"),
      requester: { channel: "telegram", accountId: "default", senderId: "200" },
    };
    await runHooks(hooks, "before_agent_run", beforeRunEvent, ctx);
    await runHooks(
      hooks,
      "before_tool_call",
      {
        toolName: "image_generate",
        params: {},
        runId: "run-unbounded-media",
        toolCallId: "tool-image-unbounded",
      },
      ctx,
    );

    const results = await runHooks(
      hooks,
      "before_billable_operation",
      {
        runId: "run-unbounded-media",
        toolCallId: "tool-image-unbounded",
        provider: "openai",
        model: "gpt-image-1.5",
        category: "image_generation",
      },
      ctx,
    );

    expect(results).toContainEqual(
      expect.objectContaining({ block: true, blockReason: expect.stringContaining("maximum") }),
    );
  });

  it("charges an exact provider-billed media total times two", async () => {
    const root = await createStateDir();
    const openingBalance = usdToNanoUsd(1);
    await credit(root, openingBalance);
    const { hooks } = register(root);
    const ctx = {
      ...agentContext("run-priced-media"),
      requester: { channel: "telegram", accountId: "default", senderId: "200" },
    };
    await runHooks(hooks, "before_agent_run", beforeRunEvent, ctx);
    await runHooks(
      hooks,
      "before_tool_call",
      {
        toolName: "video_generate",
        params: { durationSeconds: 4 },
        runId: "run-priced-media",
        toolCallId: "tool-video-priced",
      },
      ctx,
    );
    await runHooks(
      hooks,
      "before_billable_operation",
      {
        runId: "run-priced-media",
        toolCallId: "tool-video-priced",
        provider: "openrouter",
        model: "google/veo-3.1",
        category: "video_generation",
        costUpperBound: { totalUsd: 0.5, evidence: "catalog-upper-bound" },
      },
      ctx,
    );
    await runHooks(
      hooks,
      "billable_operation_completed",
      {
        runId: "run-priced-media",
        toolCallId: "tool-video-priced",
        provider: "openrouter",
        model: "google/veo-3.1",
        category: "video_generation",
        outcome: "completed",
        quantity: 1,
        unit: "videos",
        cost: { totalUsd: 0.4, evidence: "provider-billed" },
      },
      ctx,
    );
    await runHooks(hooks, "agent_end", { messages: [], success: true }, ctx);

    await expect(snapshot(root)).resolves.toEqual({
      balanceNanoUsd: openingBalance - usdToNanoUsd(0.4) * 2,
      reservedNanoUsd: 0,
      availableNanoUsd: openingBalance - usdToNanoUsd(0.4) * 2,
    });
  });

  it("blocks a media upper bound that exceeds the citizen's prepaid balance", async () => {
    const root = await createStateDir();
    await credit(root, usdToNanoUsd(0.5));
    const { hooks } = register(root);
    const ctx = {
      ...agentContext("run-expensive-media"),
      requester: { channel: "telegram", accountId: "default", senderId: "200" },
    };
    await runHooks(hooks, "before_agent_run", beforeRunEvent, ctx);
    await runHooks(
      hooks,
      "before_tool_call",
      {
        toolName: "video_generate",
        params: {},
        runId: "run-expensive-media",
        toolCallId: "tool-video-expensive",
      },
      ctx,
    );

    const results = await runHooks(
      hooks,
      "before_billable_operation",
      {
        runId: "run-expensive-media",
        toolCallId: "tool-video-expensive",
        provider: "openrouter",
        model: "google/veo-3.1",
        category: "video_generation",
        costUpperBound: { totalUsd: 0.5, evidence: "catalog-upper-bound" },
      },
      ctx,
    );

    expect(results).toContainEqual(
      expect.objectContaining({
        block: true,
        blockReason: expect.stringContaining("cannot cover"),
      }),
    );
  });

  it("fails closed when a paid run has no provable requester identity", async () => {
    const root = await createStateDir();
    await credit(root, usdToNanoUsd(1));
    const { hooks } = register(root);

    const results = await runHooks(
      hooks,
      "before_agent_run",
      { prompt: "Привет", messages: [] },
      { runId: "run-no-identity", agentId: "main", modelId: "gpt-5.6-terra" },
    );

    expect(results).toContainEqual({
      outcome: "block",
      reason: "SG cannot prove the payer Global ID",
      message: "Не удалось подтвердить доступ к СГ. Запрос не выполнен. Попробуйте ещё раз позже.",
      category: "cost_identity_unresolved",
    });
  });
});
