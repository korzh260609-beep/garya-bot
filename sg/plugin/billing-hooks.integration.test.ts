import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { upsertSessionEntry } from "openclaw/plugin-sdk/session-store-runtime";
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

async function entries(root: string, globalId: string) {
  const ledger = new SgBillingLedger(root);
  try {
    return await ledger.entries(globalId);
  } finally {
    ledger.close();
  }
}

async function createSpawnedSession(params: {
  root: string;
  agentId: string;
  sessionKey: string;
  sessionId: string;
  spawnedBy: string;
}) {
  await upsertSessionEntry({
    agentId: params.agentId,
    env: { ...process.env, OPENCLAW_STATE_DIR: params.root },
    sessionKey: params.sessionKey,
    entry: {
      sessionId: params.sessionId,
      updatedAt: Date.now(),
      spawnedBy: params.spawnedBy,
    },
  });
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

  it("passes a trusted OpenClaw owner even when the SG profile lookup is unavailable", async () => {
    const root = await createStateDir();
    await rm(path.join(root, "sg", "global-profiles.json"));
    const { hooks } = register(root);

    const results = await runHooks(
      hooks,
      "before_agent_run",
      {
        ...beforeRunEvent,
        channelId: "100",
        senderId: "100",
        senderIsOwner: true,
      },
      {
        ...agentContext("run-trusted-owner"),
        sessionId: "session-monarch",
        sessionKey: "agent:main:telegram:direct:100",
        chatId: "telegram:100",
        channelId: "100",
        senderId: "100",
      },
    );

    expect(results).toContainEqual({ outcome: "pass" });
  });

  it("records an interactive Monarch run as expense with zero customer charge", async () => {
    const root = await createStateDir();
    const { hooks } = register(root);
    const ctx = {
      ...agentContext("run-monarch-cost"),
      sessionKey: "agent:main:telegram:direct:100",
      channelId: "100",
      chatId: "telegram:100",
      senderId: "100",
    };

    await runHooks(
      hooks,
      "before_agent_run",
      { ...beforeRunEvent, channelId: "100", senderId: "100", senderIsOwner: true },
      ctx,
    );
    await runHooks(
      hooks,
      "model_call_ended",
      {
        runId: "run-monarch-cost",
        callId: "call-monarch-cost",
        provider: "openai",
        model: "gpt-5.6-terra",
        durationMs: 10,
        outcome: "completed",
        usage: { cost: { total: 0.0002, totalOrigin: "provider-billed" } },
      },
      ctx,
    );
    await runHooks(hooks, "agent_end", { messages: [], success: true }, ctx);

    await expect(entries(root, "usr_monarch")).resolves.toEqual([
      expect.objectContaining({
        type: "complete",
        actualCostNanoUsd: usdToNanoUsd(0.0002),
        chargedNanoUsd: 0,
        sourceKind: "request",
        parts: [
          expect.objectContaining({
            kind: "model",
            provider: "openai",
            model: "gpt-5.6-terra",
            costEvidence: "provider-billed",
            actualCostNanoUsd: usdToNanoUsd(0.0002),
          }),
        ],
      }),
    ]);
  });

  it("attributes token-priced model usage to the Monarch without charging him", async () => {
    const root = await createStateDir();
    const { hooks } = register(root);
    const ctx = {
      ...agentContext("run-monarch-token-cost"),
      sessionKey: "agent:main:telegram:direct:100",
      channelId: "100",
      chatId: "telegram:100",
      senderId: "100",
    };

    await runHooks(
      hooks,
      "before_agent_run",
      { ...beforeRunEvent, channelId: "100", senderId: "100", senderIsOwner: true },
      ctx,
    );
    await runHooks(
      hooks,
      "before_model_call",
      {
        runId: "run-monarch-token-cost",
        callId: "call-monarch-token-cost",
        provider: "openai",
        model: "gpt-5.6-terra",
        maxOutputTokens: 1_000,
        inputUpperBoundTokens: 1_000,
        cost: { input: 2, output: 12, cacheRead: 0.2, cacheWrite: 2.5 },
      },
      ctx,
    );
    await runHooks(
      hooks,
      "model_call_ended",
      {
        runId: "run-monarch-token-cost",
        callId: "call-monarch-token-cost",
        provider: "openai",
        model: "gpt-5.6-terra",
        durationMs: 10,
        outcome: "completed",
        usage: { input: 100, output: 20, cacheRead: 10, cacheWrite: 5 },
      },
      ctx,
    );
    await runHooks(hooks, "agent_end", { messages: [], success: true }, ctx);

    await expect(entries(root, "usr_monarch")).resolves.toEqual([
      expect.objectContaining({
        actualCostNanoUsd: usdToNanoUsd(0.0004545),
        chargedNanoUsd: 0,
        parts: [
          expect.objectContaining({
            inputTokens: 100,
            outputTokens: 20,
            cacheReadTokens: 10,
            cacheWriteTokens: 5,
            costEvidence: "catalog-estimate",
          }),
        ],
      }),
    ]);
  });

  it("binds a native automation to its proven Monarch creator and admits its cron run", async () => {
    const root = await createStateDir();
    const { hooks } = register(root);
    const toolCtx = {
      ...agentContext("run-create-automation"),
      toolName: "automations",
      toolCallId: "tool-add-automation",
      requester: { channel: "telegram", accountId: "default", senderId: "100" },
    };
    const toolEvent = {
      toolName: "automations",
      toolCallId: "tool-add-automation",
      params: { action: "add", job: { name: "Daily" } },
    };
    await runHooks(hooks, "before_tool_call", toolEvent, toolCtx);
    await runHooks(
      hooks,
      "after_tool_call",
      { ...toolEvent, result: { details: { id: "job-daily" } } },
      toolCtx,
    );

    const cronCtx = {
      runId: "cron:job-daily:1",
      trigger: "cron",
      agentId: "main",
      sessionKey: "agent:main:cron:job-daily:run:1",
      modelProviderId: "openai",
      modelId: "gpt-5.6-terra",
    };
    const admitted = await runHooks(
      hooks,
      "before_agent_run",
      { prompt: "Daily", messages: [] },
      cronCtx,
    );

    expect(admitted).toContainEqual({ outcome: "pass" });
    await runHooks(
      hooks,
      "model_call_ended",
      {
        runId: "cron:job-daily:1",
        callId: "call-cron",
        provider: "openai",
        model: "gpt-5.6-terra",
        durationMs: 10,
        outcome: "completed",
        usage: { cost: { total: 0.0001, totalOrigin: "provider-billed" } },
      },
      cronCtx,
    );
    await runHooks(hooks, "agent_end", { messages: [], success: true }, cronCtx);
    await expect(entries(root, "usr_monarch")).resolves.toEqual([
      expect.objectContaining({
        actualCostNanoUsd: usdToNanoUsd(0.0001),
        chargedNanoUsd: 0,
        sourceKind: "automation",
        sourceId: "job-daily",
      }),
    ]);
  });

  it("uses the proven run correlation for Monarch media in a native cron run", async () => {
    const root = await createStateDir();
    const setup = new SgBillingLedger(root);
    await setup.bindAutomationOwner({
      jobId: "job-daily-image",
      globalId: "usr_monarch",
      role: "monarch",
    });
    setup.close();
    const { hooks } = register(root);
    const ctx = {
      runId: "cron:job-daily-image:1",
      jobId: "job-daily-image",
      trigger: "cron",
      agentId: "main",
      sessionKey: "agent:main:cron:job-daily-image:run:1",
      modelProviderId: "openai",
      modelId: "gpt-5.6-terra",
    };

    await expect(
      runHooks(hooks, "before_agent_run", { prompt: "Daily image", messages: [] }, ctx),
    ).resolves.toContainEqual({ outcome: "pass" });
    await expect(
      runHooks(
        hooks,
        "before_tool_call",
        {
          toolName: "image_generate",
          params: { size: "1024x1024" },
          runId: ctx.runId,
          toolCallId: "tool-daily-image",
        },
        ctx,
      ),
    ).resolves.not.toContainEqual(expect.objectContaining({ block: true }));
    await expect(
      runHooks(
        hooks,
        "before_billable_operation",
        {
          runId: ctx.runId,
          toolCallId: "tool-daily-image",
          provider: "openai",
          model: "gpt-image-1.5",
          category: "image_generation",
        },
        ctx,
      ),
    ).resolves.toContainEqual({ block: false });
  });

  it("blocks paid media without a proven run correlation or requester", async () => {
    const root = await createStateDir();
    const { hooks } = register(root);

    await expect(
      runHooks(
        hooks,
        "before_tool_call",
        {
          toolName: "image_generate",
          params: { size: "1024x1024" },
          runId: "cron:unknown:1",
          toolCallId: "tool-unknown-image",
        },
        {
          runId: "cron:unknown:1",
          trigger: "cron",
          agentId: "main",
          sessionKey: "agent:main:cron:unknown:run:1",
        },
      ),
    ).resolves.toContainEqual({
      block: true,
      blockReason: "SG cannot prove the payer or paid-operation correlation",
    });
  });

  it("preserves verified billing identity through subagent delegation and return", async () => {
    const root = await createStateDir();
    const { hooks } = register(root);
    const parentSessionKey = "agent:main:telegram:direct:100";
    const childSessionKey = "agent:research:subagent:billing-check";

    const parent = await runHooks(
      hooks,
      "before_agent_run",
      { ...beforeRunEvent, channelId: "100", senderId: "100", senderIsOwner: true },
      {
        ...agentContext("run-parent"),
        sessionId: "session-parent",
        sessionKey: parentSessionKey,
        channelId: "100",
        senderId: "100",
      },
    );
    await createSpawnedSession({
      root,
      agentId: "research",
      sessionKey: childSessionKey,
      sessionId: "session-child",
      spawnedBy: parentSessionKey,
    });

    const child = await runHooks(
      hooks,
      "before_agent_run",
      { prompt: "Check billing", messages: [] },
      {
        runId: "run-child",
        agentId: "research",
        sessionId: "session-child",
        sessionKey: childSessionKey,
        modelProviderId: "openai",
        modelId: "gpt-5.6-terra",
      },
    );
    const continuation = await runHooks(
      hooks,
      "before_agent_run",
      { prompt: "Announce the subagent result", messages: [] },
      {
        runId: "run-parent-continuation",
        agentId: "main",
        sessionId: "session-parent",
        sessionKey: parentSessionKey,
      },
    );

    expect(parent).toContainEqual({ outcome: "pass" });
    expect(child).toContainEqual({ outcome: "pass" });
    expect(continuation).toContainEqual({ outcome: "pass" });
  });

  it("preserves native subagent ownership across nested delegation", async () => {
    const root = await createStateDir();
    const { hooks } = register(root);
    const parentSessionKey = "agent:main:telegram:direct:100";
    const childSessionKey = "agent:research:subagent:billing-child";
    const grandchildSessionKey = "agent:reviewer:subagent:billing-grandchild";

    await runHooks(
      hooks,
      "before_agent_run",
      { ...beforeRunEvent, channelId: "100", senderId: "100", senderIsOwner: true },
      {
        ...agentContext("run-nested-parent"),
        sessionKey: parentSessionKey,
        channelId: "100",
        senderId: "100",
      },
    );
    await createSpawnedSession({
      root,
      agentId: "research",
      sessionKey: childSessionKey,
      sessionId: "session-nested-child",
      spawnedBy: parentSessionKey,
    });
    await runHooks(
      hooks,
      "before_agent_run",
      { prompt: "First delegation", messages: [] },
      { runId: "run-nested-child", agentId: "research", sessionKey: childSessionKey },
    );
    await createSpawnedSession({
      root,
      agentId: "reviewer",
      sessionKey: grandchildSessionKey,
      sessionId: "session-nested-grandchild",
      spawnedBy: childSessionKey,
    });

    const grandchild = await runHooks(
      hooks,
      "before_agent_run",
      { prompt: "Second delegation", messages: [] },
      { runId: "run-nested-grandchild", agentId: "reviewer", sessionKey: grandchildSessionKey },
    );

    expect(grandchild).toContainEqual({ outcome: "pass" });
  });

  it("keeps an unowned native subagent blocked", async () => {
    const root = await createStateDir();
    const { hooks } = register(root);
    const childSessionKey = "agent:research:subagent:unowned";
    await createSpawnedSession({
      root,
      agentId: "research",
      sessionKey: childSessionKey,
      sessionId: "session-unowned",
      spawnedBy: "agent:main:telegram:direct:unknown",
    });

    const result = await runHooks(
      hooks,
      "before_agent_run",
      { prompt: "Unowned", messages: [] },
      { runId: "run-unowned-child", agentId: "research", sessionKey: childSessionKey },
    );

    expect(result).toContainEqual(
      expect.objectContaining({ outcome: "block", category: "cost_identity_unresolved" }),
    );
  });

  it("preserves the automation source when its bound Monarch run delegates", async () => {
    const root = await createStateDir();
    const setup = new SgBillingLedger(root);
    await setup.bindAutomationOwner({
      jobId: "job-delegating",
      globalId: "usr_monarch",
      role: "monarch",
    });
    setup.close();
    const { hooks } = register(root);
    const parentSessionKey = "agent:main:cron:job-delegating:run:1";
    const childSessionKey = "agent:research:subagent:automation-child";

    await runHooks(
      hooks,
      "before_agent_run",
      { prompt: "Scheduled check", messages: [] },
      {
        runId: "run-automation-parent",
        jobId: "job-delegating",
        agentId: "main",
        sessionKey: parentSessionKey,
      },
    );
    await createSpawnedSession({
      root,
      agentId: "research",
      sessionKey: childSessionKey,
      sessionId: "session-automation-child",
      spawnedBy: parentSessionKey,
    });
    const childContext = {
      runId: "run-automation-child",
      agentId: "research",
      sessionKey: childSessionKey,
    };
    const admitted = await runHooks(
      hooks,
      "before_agent_run",
      { prompt: "Delegated scheduled check", messages: [] },
      childContext,
    );
    await runHooks(hooks, "agent_end", { messages: [], success: true }, childContext);

    expect(admitted).toContainEqual({ outcome: "pass" });
    await expect(entries(root, "usr_monarch")).resolves.toEqual([
      expect.objectContaining({
        operationId: "run:run-automation-child",
        sourceKind: "automation",
        sourceId: "job-delegating",
      }),
    ]);
  });

  it("keeps an unknown cron job blocked before provider I/O", async () => {
    const root = await createStateDir();
    const { hooks } = register(root);

    const results = await runHooks(
      hooks,
      "before_agent_run",
      { prompt: "Unknown", messages: [] },
      {
        runId: "cron:unknown:1",
        trigger: "cron",
        agentId: "main",
        sessionKey: "agent:main:cron:unknown:run:1",
      },
    );

    expect(results).toContainEqual(
      expect.objectContaining({
        outcome: "block",
        reason: "SG automation has no active trusted billing owner",
        category: "cost_identity_unresolved",
      }),
    );
  });

  it("enforces the existing prepaid charge for a citizen-owned cron job", async () => {
    const root = await createStateDir();
    const openingBalance = usdToNanoUsd(1);
    await credit(root, openingBalance);
    const setup = new SgBillingLedger(root);
    await setup.bindAutomationOwner({
      jobId: "job-citizen",
      globalId: "usr_citizen",
      role: "citizen",
    });
    setup.close();
    const { hooks } = register(root);
    const ctx = {
      runId: "cron:job-citizen:1",
      jobId: "job-citizen",
      trigger: "cron",
      agentId: "main",
      sessionKey: "agent:main:cron:job-citizen:run:1",
      modelProviderId: "openai",
      modelId: "gpt-5.6-terra",
    };

    const admitted = await runHooks(
      hooks,
      "before_agent_run",
      { prompt: "Citizen daily", messages: [] },
      ctx,
    );
    expect(admitted).toContainEqual({ outcome: "pass" });
    await runHooks(
      hooks,
      "model_call_ended",
      {
        runId: "cron:job-citizen:1",
        callId: "call-citizen-cron",
        provider: "openai",
        model: "gpt-5.6-terra",
        durationMs: 10,
        outcome: "completed",
        usage: { cost: { total: 0.0001, totalOrigin: "provider-billed" } },
      },
      ctx,
    );
    await runHooks(hooks, "agent_end", { messages: [], success: true }, ctx);

    expect((await snapshot(root)).balanceNanoUsd).toBe(openingBalance - usdToNanoUsd(0.0001) * 2);
  });

  it("tracks Monarch media without requiring a prepaid upper bound", async () => {
    const root = await createStateDir();
    const { hooks } = register(root);
    const ctx = {
      ...agentContext("run-monarch-media"),
      sessionKey: "agent:main:telegram:direct:100",
      channelId: "100",
      senderId: "100",
      requester: { channel: "telegram", accountId: "default", senderId: "100" },
    };
    await runHooks(
      hooks,
      "before_agent_run",
      { ...beforeRunEvent, channelId: "100", senderId: "100", senderIsOwner: true },
      ctx,
    );
    await runHooks(
      hooks,
      "before_tool_call",
      {
        toolName: "image_generate",
        params: {},
        runId: "run-monarch-media",
        toolCallId: "tool-monarch-image",
      },
      ctx,
    );
    const authorized = await runHooks(
      hooks,
      "before_billable_operation",
      {
        runId: "run-monarch-media",
        toolCallId: "tool-monarch-image",
        provider: "openai",
        model: "gpt-image-1.5",
        category: "image_generation",
      },
      ctx,
    );
    expect(authorized).toContainEqual({ block: false });
    await runHooks(
      hooks,
      "billable_operation_completed",
      {
        runId: "run-monarch-media",
        toolCallId: "tool-monarch-image",
        provider: "openai",
        model: "gpt-image-1.5",
        category: "image_generation",
        outcome: "completed",
        quantity: 1,
        unit: "images",
        cost: { totalUsd: 0.01, evidence: "provider-billed" },
      },
      ctx,
    );
    await runHooks(hooks, "agent_end", { messages: [], success: true }, ctx);
    await expect(entries(root, "usr_monarch")).resolves.toEqual([
      expect.objectContaining({
        actualCostNanoUsd: usdToNanoUsd(0.01),
        chargedNanoUsd: 0,
        parts: [
          expect.objectContaining({
            kind: "tool",
            toolName: "image_generate",
            provider: "openai",
            model: "gpt-image-1.5",
            costEvidence: "provider-billed",
          }),
        ],
      }),
    ]);
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

  it("settles token usage with the authorized catalog rates when provider cost is missing", async () => {
    const root = await createStateDir();
    const openingBalance = usdToNanoUsd(1);
    await credit(root, openingBalance);
    const { hooks, warn } = register(root);
    const ctx = agentContext("run-cost-missing");
    await runHooks(hooks, "before_agent_run", beforeRunEvent, ctx);
    await runHooks(
      hooks,
      "before_model_call",
      {
        runId: "run-cost-missing",
        callId: "call-cost-missing",
        provider: "openai",
        model: "gpt-5.6-terra",
        maxOutputTokens: 1_000,
        inputUpperBoundTokens: 1_000,
        cost: { input: 2, output: 12, cacheRead: 0.2, cacheWrite: 2.5 },
      },
      ctx,
    );

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

    await expect(snapshot(root)).resolves.toEqual({
      balanceNanoUsd: openingBalance - usdToNanoUsd(0.00044) * 2,
      reservedNanoUsd: 0,
      availableNanoUsd: openingBalance - usdToNanoUsd(0.00044) * 2,
    });
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("provider cost unavailable"));
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
      message: "Недостаточно средств. Сначала пополните баланс.",
      category: "cost_identity_unresolved",
    });
  });
});
