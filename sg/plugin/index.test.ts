import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { resolveSgCanonicalIdentity, resolveWorkspaceContext } from "./context.js";
import { registerWorkspaceManager } from "./register.js";
import { SgWorkspaceRegistry } from "./workspace-registry.js";

const timestamp = "2026-01-01T00:00:00.000Z";

async function stateDirWithProfiles() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-wsp1-"));
  const target = path.join(root, "sg", "global-profiles.json");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
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
  return { root, target };
}

const diagnosticInput = (overrides: Record<string, unknown> = {}) => ({
  channel: "telegram",
  senderId: "100",
  ...overrides,
});

function registerDispatchHook(root: string, warn = vi.fn()) {
  const hooks = new Map<string, (...args: unknown[]) => unknown>();
  registerWorkspaceManager({
    registerCommand: vi.fn(),
    registerTool: vi.fn(),
    on: vi.fn((name, handler) => hooks.set(name, handler)),
    logger: { info: vi.fn(), warn },
    runtime: { state: { resolveStateDir: () => root } },
  });
  const hook = hooks.get("before_dispatch");
  if (!hook) {
    throw new Error("before_dispatch hook was not registered");
  }
  return hook;
}

describe("SG Workspace Manager", () => {
  it("uses OpenClaw identityLinks and fails closed when they are ambiguous", () => {
    expect(
      resolveSgCanonicalIdentity({
        channel: "telegram",
        senderId: "100",
        identityLinks: { gary: ["telegram:100"] },
      }),
    ).toBe("linked:gary");
    expect(
      resolveSgCanonicalIdentity({
        channel: "telegram",
        senderId: "100",
        identityLinks: { first: ["telegram:100"], second: ["telegram:100"] },
      }),
    ).toBeUndefined();
  });

  it("resolves the monarch in a direct chat without writing the profile store", async () => {
    const { root, target } = await stateDirWithProfiles();
    const before = await readFile(target, "utf8");
    const beforeStat = await stat(target);
    const result = await resolveWorkspaceContext(diagnosticInput({ to: "telegram:100" }), root);
    expect(result).toMatchObject({
      globalId: "usr_monarch",
      projectRole: "monarch",
      channel: "telegram",
      resourceId: "telegram:100",
    });
    expect(await readFile(target, "utf8")).toBe(before);
    expect((await stat(target)).mtimeMs).toBe(beforeStat.mtimeMs);
  });

  it("resolves the same monarch in a group and preserves group/topic context", async () => {
    const { root } = await stateDirWithProfiles();
    await expect(
      resolveWorkspaceContext(
        diagnosticInput({ to: "telegram:-100500", messageThreadId: 42, accountId: "default" }),
        root,
      ),
    ).resolves.toMatchObject({
      globalId: "usr_monarch",
      projectRole: "monarch",
      resourceId: "telegram:-100500",
      topicId: "42",
      accountId: "default",
    });
  });

  it("creates a durable citizen for an unknown valid sender", async () => {
    const { root, target } = await stateDirWithProfiles();
    const result = await resolveWorkspaceContext(
      diagnosticInput({ senderId: "999", to: "telegram:999" }),
      root,
    );
    expect(result).toMatchObject({ projectRole: "citizen" });
    expect(result.globalId).toMatch(/^usr_/u);
    const persisted = JSON.parse(await readFile(target, "utf8"));
    expect(persisted.profiles).toContainEqual(
      expect.objectContaining({
        globalId: result.globalId,
        canonicalIdentity: "channel:telegram:999",
        role: "citizen",
        status: "active",
      }),
    );
  });

  it("returns the same identity after a simulated plugin restart", async () => {
    const { root } = await stateDirWithProfiles();
    const first = await resolveWorkspaceContext(diagnosticInput(), root);
    vi.resetModules();
    const restarted = await import("./context.js");
    const second = await restarted.resolveWorkspaceContext(diagnosticInput(), root);
    expect(second).toEqual(first);
  });

  it("registers only WSP5/WSP6 tools and current diagnostics", async () => {
    const { root } = await stateDirWithProfiles();
    const registerCommand = vi.fn();
    const registerInteractiveHandler = vi.fn();
    const registerTool = vi.fn();
    const on = vi.fn();
    registerWorkspaceManager({
      config: {},
      registerCommand,
      registerInteractiveHandler,
      registerTool,
      on,
      runtime: {
        state: { resolveStateDir: () => root },
        channel: { outbound: { loadAdapter: vi.fn(async () => undefined) } },
      },
    });

    expect(registerCommand.mock.calls.map((call) => call[0]?.name)).toEqual([
      "sg_context",
      "sg_workspace",
      "sg_wsp5_diag",
      "sg_wsp6_diag",
      "sg_context_diag",
      "sg_cost_diag",
    ]);
    const toolNames = registerTool.mock.calls.flatMap((call) => call[1]?.names ?? []);
    expect(toolNames).toEqual([
      "sg_content_draft",
      "sg_content_review",
      "sg_content_publish",
      "sg_content_schedule",
      "sg_content_dispatch",
      "sg_test_manage",
      "sg_test_attempt",
      "sg_test_stats",
    ]);
    expect(registerInteractiveHandler).toHaveBeenCalledWith({
      channel: "telegram",
      namespace: "sg6",
      handler: expect.any(Function),
    });
    expect(on).toHaveBeenCalledWith("before_dispatch", expect.any(Function));
  });

  it("injects identity plus WSP5/WSP6 guidance without onboarding guidance", async () => {
    const { root } = await stateDirWithProfiles();
    const hooks = new Map<string, (...args: unknown[]) => unknown>();
    registerWorkspaceManager({
      registerCommand: vi.fn(),
      registerTool: vi.fn(),
      on: vi.fn((name, handler) => hooks.set(name, handler)),
      runtime: { state: { resolveStateDir: () => root } },
    });

    const result = (await hooks.get("before_prompt_build")?.(
      {},
      { channel: "telegram", conversationId: "telegram:100", senderId: "100" },
    )) as { prependSystemContext?: string };
    expect(result.prependSystemContext).toContain("Роль SG: monarch");
    expect(result.prependSystemContext).toContain("штатным automations");
    expect(result.prependSystemContext).toContain("обычные опросы отправляй штатным message");
    expect(result.prependSystemContext).not.toMatch(/sg_workspace_(?:onboard|pending|decide)/u);
  });

  it("creates and attaches the citizen identity before an ordinary model call", async () => {
    const { root, target } = await stateDirWithProfiles();
    const hooks = new Map<string, (...args: unknown[]) => unknown>();
    registerWorkspaceManager({
      registerCommand: vi.fn(),
      registerTool: vi.fn(),
      on: vi.fn((name, handler) => hooks.set(name, handler)),
      runtime: { state: { resolveStateDir: () => root } },
    });

    const result = await hooks.get("before_prompt_build")?.(
      {},
      {
        channel: "telegram",
        accountId: "default",
        conversationId: "telegram:999",
        senderId: "999",
      },
    );
    expect(result).toMatchObject({
      prependSystemContext: expect.stringMatching(
        /Global ID: usr_[a-f0-9-]+[\s\S]*Роль SG: citizen/u,
      ),
    });
    const persisted = JSON.parse(await readFile(target, "utf8"));
    expect(persisted.profiles).toContainEqual(
      expect.objectContaining({ canonicalIdentity: "channel:telegram:999", role: "citizen" }),
    );
  });

  it("reports the live isolated session and cost guards only to the monarch", async () => {
    const { root } = await stateDirWithProfiles();
    const commands: Array<{
      name: string;
      handler: (ctx: Record<string, unknown>) => Promise<{ text: string }>;
    }> = [];
    registerWorkspaceManager({
      registerCommand: vi.fn((command) => commands.push(command)),
      registerTool: vi.fn(),
      on: vi.fn(),
      runtime: { state: { resolveStateDir: () => root } },
    });
    const command = commands.find((candidate) => candidate.name === "sg_cost_diag");
    const config = {
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
          contextPruning: { mode: "cache-ttl", ttl: "5m", hardClear: { enabled: true } },
        },
      },
    };
    await expect(
      command?.handler({
        channel: "telegram",
        senderId: "100",
        sessionKey: "agent:main:telegram:direct:100",
        config,
      }),
    ).resolves.toEqual({ text: expect.stringContaining("SG COST DIAG — PASS") });
    await expect(
      command?.handler({
        channel: "telegram",
        senderId: "200",
        sessionKey: "agent:main:telegram:direct:200",
        config,
      }),
    ).resolves.toEqual({ text: "SG COST DIAG — доступ разрешён только монарху" });
  });

  it("returns an explicit missing scope without creating storage", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "sg-resource-command-"));
    const registerCommand = vi.fn();
    registerWorkspaceManager({
      registerCommand,
      registerTool: vi.fn(),
      on: vi.fn(),
      runtime: { state: { resolveStateDir: () => root } },
    });
    const command = registerCommand.mock.calls[1]?.[0];
    await expect(
      command.handler({
        channel: "telegram",
        accountId: "default",
        to: "telegram:-100500",
        senderId: "100",
        config: {},
      }),
    ).resolves.toEqual({ text: "SG Workspace Manager — ресурс не зарегистрирован" });
    await expect(stat(path.join(root, "sg", "workspaces.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("records one neutral scope after native group admission without claiming the reply", async () => {
    const { root } = await stateDirWithProfiles();
    const hook = registerDispatchHook(root);
    const event = { content: "СГ, привет", isGroup: true, channel: "telegram", senderId: "200" };
    const context = {
      sessionKey: "agent:main:telegram:group:-100500",
      channelId: "telegram",
      accountId: "default",
      conversationId: "telegram:-100500",
      senderId: "200",
    };

    await expect(hook(event, context)).resolves.toEqual({ handled: false });
    await expect(hook(event, context)).resolves.toEqual({ handled: false });
    const scopes = await new SgWorkspaceRegistry(root).list();
    expect(scopes).toHaveLength(1);
    expect(scopes[0]).toMatchObject({
      platform: "telegram",
      accountId: "default",
      resourceId: "telegram:-100500",
      resourceKind: "group",
    });
    expect(scopes[0]).not.toHaveProperty("ownerGlobalId");
    expect(scopes[0]).not.toHaveProperty("status");
  });

  it.each(["/new", "/new@ASSISTANT_SG_bot"])(
    "lets the native command %s continue without creating scope state",
    async (content) => {
      const { root } = await stateDirWithProfiles();
      await expect(
        registerDispatchHook(root)(
          { content, isGroup: true, channel: "telegram", senderId: "200" },
          {
            sessionKey: "agent:main:telegram:slash:200",
            channelId: "telegram",
            conversationId: "telegram:-100500",
            senderId: "200",
          },
        ),
      ).resolves.toEqual({ handled: false });
      await expect(stat(path.join(root, "sg", "workspaces.json"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    },
  );

  it("does not create a resource scope in a direct chat", async () => {
    const { root } = await stateDirWithProfiles();
    await expect(
      registerDispatchHook(root)(
        { content: "Привет", isGroup: false, channel: "telegram", senderId: "200" },
        {
          sessionKey: "agent:main:telegram:direct:200",
          channelId: "telegram",
          conversationId: "telegram:200",
          senderId: "200",
        },
      ),
    ).resolves.toEqual({ handled: false });
    await expect(stat(path.join(root, "sg", "workspaces.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("fails open for replies when trusted group route fields are missing", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "sg-resource-missing-context-"));
    const warn = vi.fn();
    await expect(
      registerDispatchHook(root, warn)(
        { content: "Привет", isGroup: true, channel: "telegram", senderId: "200" },
        { sessionKey: "private-run-id", channelId: "telegram", senderId: "200" },
      ),
    ).resolves.toEqual({ handled: false });
    expect(warn).toHaveBeenCalledWith(
      "SG resource scope registration skipped: trusted route is incomplete",
    );
    expect(warn.mock.calls.flat().join(" ")).not.toContain("private-run-id");
    await expect(stat(path.join(root, "sg", "workspaces.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
