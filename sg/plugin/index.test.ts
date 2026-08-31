import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { resolveSgCanonicalIdentity, resolveWorkspaceContext } from "./context.js";
import { registerWorkspaceManager } from "./register.js";
import { SgWorkspaceRequestRegistry } from "./workspace-requests.js";

const timestamp = "2026-01-01T00:00:00.000Z";

async function stateDirWithProfiles() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-wsp1-"));
  const target = path.join(root, "sg", "global-profiles.json");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
    JSON.stringify({
      version: 2,
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

describe("SG Workspace Manager WSP1", () => {
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

  it("resolves an unknown sender to guest without creating a profile", async () => {
    const { root, target } = await stateDirWithProfiles();
    const before = await readFile(target, "utf8");
    const result = await resolveWorkspaceContext(
      diagnosticInput({ senderId: "999", to: "telegram:999" }),
      root,
    );
    expect(result).toMatchObject({ projectRole: "guest" });
    expect(result).not.toHaveProperty("globalId");
    expect(await readFile(target, "utf8")).toBe(before);
  });

  it("returns the same read-only identity after a simulated plugin restart", async () => {
    const { root } = await stateDirWithProfiles();
    const first = await resolveWorkspaceContext(diagnosticInput(), root);
    vi.resetModules();
    const restarted = await import("./context.js");
    const second = await restarted.resolveWorkspaceContext(diagnosticInput(), root);
    expect(second).toEqual(first);
  });

  it("registers normal reply commands plus only internal WSP3 tools and guidance", async () => {
    const registerCommand = vi.fn();
    const registerTool = vi.fn();
    const on = vi.fn();
    registerWorkspaceManager({
      registerCommand,
      registerTool,
      on,
      runtime: { state: { resolveStateDir: () => "/tmp/sg-wsp-test" } },
    });
    expect(registerCommand).toHaveBeenCalledTimes(3);
    const command = registerCommand.mock.calls[0]?.[0];
    expect(command).toMatchObject({ name: "sg_context", requireAuth: false });
    expect(registerCommand.mock.calls[1]?.[0]).toMatchObject({
      name: "sg_workspace",
      requireAuth: false,
    });
    expect(registerCommand.mock.calls[2]?.[0]).toMatchObject({
      name: "sg_wsp3_diag",
      requireAuth: false,
    });
    expect(registerTool).toHaveBeenCalledWith(expect.any(Function), {
      names: ["sg_workspace_onboard", "sg_workspace_pending", "sg_workspace_decide"],
    });
    expect(on).toHaveBeenCalledWith("before_dispatch", expect.any(Function));
  });

  it("adds pending-list tool guidance through the native prompt hook", async () => {
    const hooks = new Map<string, (...args: unknown[]) => unknown>();
    registerWorkspaceManager({
      registerCommand: vi.fn(),
      registerTool: vi.fn(),
      on: vi.fn((name, handler) => hooks.set(name, handler)),
      runtime: { state: { resolveStateDir: () => "/tmp/sg-wsp-test" } },
    });

    const result = await hooks.get("before_prompt_build")?.({}, {});
    expect(result).toMatchObject({
      prependSystemContext: expect.stringContaining("обязательно используй sg_workspace_pending"),
    });
  });

  it("reports the complete pending-list chain and identifies model tool-selection failure", async () => {
    const { root } = await stateDirWithProfiles();
    await new SgWorkspaceRequestRegistry(root).create({
      platform: "telegram",
      accountId: "default",
      resourceId: "telegram:-100500",
      resourceKind: "group",
      title: "SG Freelander 2",
      initiatorCanonicalIdentity: "channel:telegram:200",
      initiatorGlobalId: "usr_citizen",
    });
    const commands: Array<{
      name: string;
      handler: (ctx: Record<string, unknown>) => Promise<{ text: string }>;
    }> = [];
    const hooks = new Map<string, (...args: unknown[]) => unknown>();
    registerWorkspaceManager({
      registerCommand: vi.fn((command) => commands.push(command)),
      registerTool: vi.fn(),
      on: vi.fn((name, handler) => hooks.set(name, handler)),
      runtime: { state: { resolveStateDir: () => root } },
    });

    await hooks.get("before_prompt_build")?.(
      { prompt: "Покажи ожидающие заявки на подключение сообществ" },
      {
        runId: "run-pending",
        sessionKey: "agent:main:telegram:isolated-model-session",
        channel: "telegram",
        accountId: "default",
        senderId: "100",
        toolAuthority: { allows: (name: string) => name === "sg_workspace_pending" },
      },
    );
    await hooks.get("llm_input")?.(
      {
        runId: "run-pending",
        sessionId: "session-pending",
        provider: "openai",
        model: "gpt-test",
        prompt: "Покажи ожидающие заявки на подключение сообществ",
        historyMessages: [],
        imagesCount: 0,
        tools: [{ name: "sg_workspace_pending" }],
      },
      {
        runId: "run-pending",
        sessionKey: "agent:main:telegram:isolated-model-session",
        channel: "telegram",
        accountId: "default",
        senderId: "100",
      },
    );
    await hooks.get("model_call_started")?.(
      { runId: "run-pending", callId: "call-1" },
      {
        runId: "run-pending",
        sessionKey: "agent:main:telegram:isolated-model-session",
        channel: "telegram",
        accountId: "default",
        senderId: "100",
      },
    );
    await hooks.get("before_agent_reply")?.(
      { cleanedBody: "Не вижу ожидающих заявок" },
      {
        runId: "run-pending",
        sessionKey: "agent:main:telegram:isolated-model-session",
        channel: "telegram",
        accountId: "default",
        senderId: "100",
      },
    );

    const diagnostic = commands.find((command) => command.name === "sg_wsp3_diag");
    expect(diagnostic).toBeDefined();
    const diagnosticContext = {
      channel: "telegram",
      accountId: "default",
      to: "telegram:100",
      senderId: "100",
      sessionKey: "agent:main:telegram:isolated-command-session",
      config: {},
    };
    await expect(diagnostic!.handler(diagnosticContext)).resolves.toEqual({
      text: expect.stringMatching(
        /trace_match: route[\s\S]*hook_counts: prompt=1, llm_input=1, model=1, tool_selected=0, tool_result=0, reply=1[\s\S]*prompt_hook: OK[\s\S]*pending_tool_surface: OK[\s\S]*pending_store: OK \(1: SG Freelander 2\)[\s\S]*failure: model_did_not_select_pending_tool/,
      ),
    });

    const hookContext = {
      runId: "run-pending",
      sessionKey: "agent:main:telegram:isolated-model-session",
      toolName: "sg_workspace_pending",
      requester: { channel: "telegram", accountId: "default", senderId: "100" },
    };
    await hooks.get("before_tool_call")?.(
      { toolName: "sg_workspace_pending", params: {}, runId: "run-pending" },
      hookContext,
    );
    await expect(diagnostic!.handler(diagnosticContext)).resolves.toEqual({
      text: expect.stringContaining("failure: pending_tool_result_missing"),
    });

    await hooks.get("after_tool_call")?.(
      {
        toolName: "sg_workspace_pending",
        params: {},
        runId: "run-pending",
        result: { content: [{ type: "text", text: "{}" }] },
      },
      hookContext,
    );
    await expect(diagnostic!.handler(diagnosticContext)).resolves.toEqual({
      text: expect.stringContaining("failure: pending_tool_result_invalid"),
    });

    await hooks.get("after_tool_call")?.(
      {
        toolName: "sg_workspace_pending",
        params: {},
        runId: "run-pending",
        result: { details: { status: "ok", requests: [] } },
      },
      hookContext,
    );
    await expect(diagnostic!.handler(diagnosticContext)).resolves.toEqual({
      text: expect.stringContaining("failure: pending_tool_result_store_mismatch"),
    });

    await hooks.get("after_tool_call")?.(
      {
        toolName: "sg_workspace_pending",
        params: {},
        runId: "run-pending",
        result: {
          details: { status: "ok", requests: [{ title: "SG Freelander 2" }] },
        },
      },
      hookContext,
    );
    await expect(diagnostic!.handler(diagnosticContext)).resolves.toEqual({
      text: expect.stringMatching(/pending_tool_payload: OK \(ok: 1\)[\s\S]*failure: none/),
    });
  });

  it("distinguishes missing lifecycle hooks from trace identity mismatch", async () => {
    const { root } = await stateDirWithProfiles();
    await new SgWorkspaceRequestRegistry(root).create({
      platform: "telegram",
      accountId: "default",
      resourceId: "telegram:-100501",
      resourceKind: "group",
      title: "Pending community",
      initiatorCanonicalIdentity: "channel:telegram:200",
      initiatorGlobalId: "usr_citizen",
    });
    const commands: Array<{
      name: string;
      handler: (ctx: Record<string, unknown>) => Promise<{ text: string }>;
    }> = [];
    const hooks = new Map<string, (...args: unknown[]) => unknown>();
    registerWorkspaceManager({
      registerCommand: vi.fn((command) => commands.push(command)),
      registerTool: vi.fn(),
      on: vi.fn((name, handler) => hooks.set(name, handler)),
      runtime: { state: { resolveStateDir: () => root } },
    });
    const diagnostic = commands.find((command) => command.name === "sg_wsp3_diag")!;
    const commandContext = {
      channel: "telegram",
      accountId: "default",
      to: "telegram:100",
      senderId: "100",
      sessionKey: "command-session",
      config: {},
    };

    await expect(diagnostic.handler(commandContext)).resolves.toEqual({
      text: expect.stringMatching(
        /last_trace: NONE[\s\S]*hook_counts: prompt=0, llm_input=0, model=0, tool_selected=0, tool_result=0, reply=0[\s\S]*failure: lifecycle_hooks_not_observed/,
      ),
    });

    await hooks.get("model_call_started")?.(
      { runId: "unmatched-run", callId: "call-1" },
      { runId: "unmatched-run", sessionKey: "different-session" },
    );
    await expect(diagnostic.handler(commandContext)).resolves.toEqual({
      text: expect.stringMatching(
        /trace_match: none[\s\S]*last_trace: PRESENT[\s\S]*hook_counts: prompt=0, llm_input=0, model=1[\s\S]*failure: trace_identity_mismatch/,
      ),
    });
  });

  it("detects lifecycle hooks recorded by another plugin instance", async () => {
    const { root } = await stateDirWithProfiles();
    await new SgWorkspaceRequestRegistry(root).create({
      platform: "telegram",
      accountId: "default",
      resourceId: "telegram:-100502",
      resourceKind: "group",
      title: "Cross-instance community",
      initiatorCanonicalIdentity: "channel:telegram:200",
      initiatorGlobalId: "usr_citizen",
    });
    const lifecycleHooks = new Map<string, (...args: unknown[]) => unknown>();
    registerWorkspaceManager({
      registerCommand: vi.fn(),
      registerTool: vi.fn(),
      on: vi.fn((name, handler) => lifecycleHooks.set(name, handler)),
      runtime: { state: { resolveStateDir: () => root } },
    });
    const lifecycleContext = {
      runId: "cross-instance-run",
      sessionKey: "model-instance-session",
      channel: "telegram",
      accountId: "default",
      senderId: "100",
    };
    await lifecycleHooks.get("before_prompt_build")?.(
      { prompt: "Покажи ожидающие заявки" },
      {
        ...lifecycleContext,
        toolAuthority: { allows: (name: string) => name === "sg_workspace_pending" },
      },
    );
    await lifecycleHooks.get("llm_input")?.(
      {
        runId: lifecycleContext.runId,
        sessionId: "cross-instance-session",
        provider: "openai",
        model: "gpt-test",
        prompt: "Покажи ожидающие заявки",
        historyMessages: [],
        imagesCount: 0,
        tools: [{ name: "sg_workspace_pending" }],
      },
      lifecycleContext,
    );
    await lifecycleHooks.get("model_call_started")?.(
      { runId: lifecycleContext.runId, callId: "call-1" },
      lifecycleContext,
    );
    await lifecycleHooks.get("before_agent_reply")?.({ cleanedBody: "Пусто" }, lifecycleContext);

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
    const diagnostic = commands.find((command) => command.name === "sg_wsp3_diag")!;
    await expect(
      diagnostic.handler({
        channel: "telegram",
        accountId: "default",
        to: "telegram:100",
        senderId: "100",
        sessionKey: "command-instance-session",
        config: {},
      }),
    ).resolves.toEqual({
      text: expect.stringMatching(
        /trace_match: durable-route[\s\S]*last_trace: PRESENT \(durable[\s\S]*hook_counts: prompt=0, llm_input=0, model=0, tool_selected=0, tool_result=0, reply=0[\s\S]*durable_trace: OK[\s\S]*durable_instances: 2, pids=1[\s\S]*durable_hook_location: other-instance[\s\S]*durable_hook_counts: prompt=1, llm_input=1, model=1, tool_selected=0, tool_result=0, reply=1[\s\S]*pending_tool_surface: OK[\s\S]*failure: model_did_not_select_pending_tool/,
      ),
    });
  });

  it("returns an explicit unregistered workspace through the normal reply payload", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "sg-wsp2-command-"));
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

  it("leaves ordinary OpenClaw replies untouched when the plugin is disabled", () => {
    const registerCommand = vi.fn();
    expect(registerCommand).not.toHaveBeenCalled();
  });

  it("creates a pending request from trusted current-route context without assigning owner", async () => {
    const { root } = await stateDirWithProfiles();
    const registerTool = vi.fn();
    registerWorkspaceManager({
      registerCommand: vi.fn(),
      registerTool,
      on: vi.fn(),
      runtime: { state: { resolveStateDir: () => root } },
    });
    const factory = registerTool.mock.calls[0]?.[0];
    const tools = factory({
      messageChannel: "telegram",
      agentAccountId: "default",
      nativeChannelId: "telegram:-100500",
      requesterSenderId: "200",
    });
    const onboard = tools.find((tool: { name: string }) => tool.name === "sg_workspace_onboard");
    const result = await onboard.execute("call-1", {
      resourceKind: "group",
      title: "Sandbox",
    });
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      status: "pending",
      ownerAssigned: false,
    });
  });

  it("creates and announces a pending request before replying to an ordinary group greeting", async () => {
    const { root } = await stateDirWithProfiles();
    const hooks = new Map<string, (...args: any[]) => Promise<unknown> | unknown>();
    registerWorkspaceManager({
      registerCommand: vi.fn(),
      registerTool: vi.fn(),
      on: vi.fn((name, handler) => hooks.set(name, handler)),
      runtime: { state: { resolveStateDir: () => root } },
    });

    const dispatchResult = await hooks.get("before_dispatch")?.(
      { isGroup: true, channel: "telegram", senderId: "200" },
      {
        sessionKey: "agent:main:telegram:group:-100500",
        channelId: "telegram",
        accountId: "default",
        conversationId: "telegram:-100500",
        senderId: "200",
      },
    );
    expect(dispatchResult).toMatchObject({
      handled: true,
      text: expect.stringContaining("запрос на подключение"),
    });
    await expect(new SgWorkspaceRequestRegistry(root).listPending()).resolves.toMatchObject([
      {
        status: "pending",
        resourceId: "telegram:-100500",
        initiatorGlobalId: "usr_citizen",
      },
    ]);
  });

  it("announces an existing pending request instead of falling through to the model", async () => {
    const { root } = await stateDirWithProfiles();
    const hooks = new Map<string, (...args: any[]) => Promise<unknown> | unknown>();
    registerWorkspaceManager({
      registerCommand: vi.fn(),
      registerTool: vi.fn(),
      on: vi.fn((name, handler) => hooks.set(name, handler)),
      runtime: { state: { resolveStateDir: () => root } },
    });
    const event = { isGroup: true, channel: "telegram", senderId: "200" };
    const context = {
      messageId: "message-1",
      sessionKey: "agent:main:telegram:group:-100500",
      channelId: "telegram",
      accountId: "default",
      conversationId: "telegram:-100500",
      senderId: "200",
    };

    await hooks.get("before_dispatch")?.(event, context);
    await expect(
      hooks.get("before_dispatch")?.(event, { ...context, messageId: "message-2" }),
    ).resolves.toMatchObject({
      handled: true,
      text: expect.stringContaining("уже ожидает подтверждения"),
    });
    await expect(new SgWorkspaceRequestRegistry(root).listPending()).resolves.toHaveLength(1);
  });

  it("records which required hook context fields are unavailable without logging their values", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "sg-wsp3-missing-context-"));
    const hooks = new Map<string, (...args: any[]) => Promise<unknown> | unknown>();
    const warn = vi.fn();
    const info = vi.fn();
    registerWorkspaceManager({
      registerCommand: vi.fn(),
      registerTool: vi.fn(),
      on: vi.fn((name, handler) => hooks.set(name, handler)),
      logger: { info, warn },
      runtime: { state: { resolveStateDir: () => root } },
    });

    await hooks.get("before_dispatch")?.(
      { isGroup: true, channel: "telegram" },
      {
        sessionKey: "private-run-id",
        channelId: "telegram",
        conversationId: "private-chat-id",
      },
    );

    expect(warn).toHaveBeenCalledWith(
      "SG workspace automatic onboarding skipped: missing senderId",
    );
    expect(warn.mock.calls.flat().join(" ")).not.toContain("private-run-id");
    expect(warn.mock.calls.flat().join(" ")).not.toContain("private-chat-id");
    await expect(new SgWorkspaceRequestRegistry(root).listPending()).resolves.toEqual([]);
  });

  it("does not create a workspace request in a direct chat", async () => {
    const { root } = await stateDirWithProfiles();
    const hooks = new Map<string, (...args: any[]) => Promise<unknown> | unknown>();
    registerWorkspaceManager({
      registerCommand: vi.fn(),
      registerTool: vi.fn(),
      on: vi.fn((name, handler) => hooks.set(name, handler)),
      runtime: { state: { resolveStateDir: () => root } },
    });
    await expect(
      hooks.get("before_dispatch")?.(
        { isGroup: false, channel: "telegram", senderId: "200" },
        {
          sessionKey: "run-dm",
          channelId: "telegram",
          conversationId: "telegram:200",
          senderId: "200",
        },
      ),
    ).resolves.toEqual({ handled: false });
    await expect(new SgWorkspaceRequestRegistry(root).listPending()).resolves.toEqual([]);
  });
});
