import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createPluginCommandRuntime,
  type PluginCommandDispatchContext,
} from "openclaw/plugin-sdk/plugin-command-runtime";
import type { OpenClawPluginToolContext } from "openclaw/plugin-sdk/plugin-entry";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodePairingSetupCode } from "../../src/pairing/setup-code.js";
import { registerPluginCommandInRegistry } from "../../src/plugins/command-registration.js";
import { createEmptyPluginRegistry } from "../../src/plugins/registry-empty.js";
import { withPluginRuntimeRegistryScope } from "../../src/plugins/runtime/gateway-request-scope.js";
import {
  canonicalSgDeviceIdentity,
  createSgDeviceTools,
  registerSgDeviceCommand,
  registerSgDeviceOwnershipPolicy,
  type SgDeviceAccessDeps,
} from "./device-access.js";
import { SgGlobalProfileRegistry } from "./global-profile-registry.js";

const timestamp = "2026-01-01T00:00:00.000Z";
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(monarch = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-device-"));
  roots.push(root);
  await mkdir(path.join(root, "sg"), { recursive: true });
  await writeFile(
    path.join(root, "sg", "global-profiles.json"),
    JSON.stringify({
      version: 5,
      ...(monarch ? { monarchGlobalId: "usr_a" } : {}),
      profiles: [
        {
          globalId: "usr_a",
          canonicalIdentity: "channel:telegram:100",
          role: monarch ? "monarch" : "citizen",
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          globalId: "usr_b",
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
          globalId: "usr_a",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          canonicalIdentity: "channel:telegram:200",
          globalId: "usr_b",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    }),
  );
  return root;
}

function pluginState() {
  const rows = new Map<string, unknown>();
  return {
    openKeyedStore: () => ({
      async register(key: string, value: unknown) {
        rows.set(key, value);
      },
      async registerIfAbsent(key: string, value: unknown) {
        if (rows.has(key)) return false;
        rows.set(key, value);
        return true;
      },
      async lookup(key: string) {
        return rows.get(key);
      },
      async delete(key: string) {
        return rows.delete(key);
      },
    }),
  };
}

function toolContext(senderId: string): OpenClawPluginToolContext {
  return {
    config: {},
    messageChannel: "telegram",
    requesterSenderId: senderId,
    nativeChannelId: senderId,
  };
}

function details(result: unknown): Record<string, unknown> {
  return (result as { details: Record<string, unknown> }).details;
}

function nativeConnect(
  root: string,
  deps: SgDeviceAccessDeps,
  config = {
    gateway: { publicOrigin: "https://sg.example" },
  },
) {
  const registry = createEmptyPluginRegistry();
  registerSgDeviceCommand(
    {
      config,
      runtime: {},
      on: vi.fn(),
      registerCommand: (command) => {
        expect(registerPluginCommandInRegistry(registry, "sg-workspace-manager", command).ok).toBe(
          true,
        );
      },
    },
    root,
    deps,
  );
  const runtime = withPluginRuntimeRegistryScope(registry, () => createPluginCommandRuntime());
  return async (overrides: Partial<PluginCommandDispatchContext> = {}) => {
    const channel = overrides.channel ?? "telegram";
    const candidate = runtime
      .listNativeCandidates(channel)
      .find((entry) => entry.name === "sg_connect");
    expect(candidate?.requireAuth).toBe(true);
    const dispatch = candidate!.prepareDispatch();
    if (dispatch.kind !== "plugin") throw new Error("native-command-not-registered");
    return dispatch.execute({
      channel,
      senderId: "100",
      from: `${channel}:100`,
      to: `${channel}:100`,
      isAuthorizedSender: true,
      commandBody: "/sg_connect",
      config,
      ...overrides,
    });
  };
}

describe("SG device access", () => {
  it("never issues or exposes pairing credentials through the agent tool", async () => {
    const root = await fixture();
    const issueNodeBootstrap = vi.fn(async () => ({ token: "secret", expiresAtMs: 1_600_000 }));
    const tool = createSgDeviceTools(
      toolContext("100"),
      root,
      {
        config: { gateway: { publicOrigin: "https://sg.example" } },
        runtime: {},
        on: vi.fn(),
      },
      {
        now: () => 1_000_000,
        listPairing: async () => ({ pending: [], paired: [] }),
        issueNodeBootstrap,
      },
    )[0]!;

    const result = details(await tool.execute("connect", { action: "connect" }));
    expect(issueNodeBootstrap).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "command-required", command: "/sg_connect" });
    expect(result).not.toHaveProperty("setupCode");
  });

  it("stores OpenClaw device ownership in the existing Global ID identity registry", async () => {
    const root = await fixture();
    const registry = new SgGlobalProfileRegistry(root);

    await registry.linkIdentity("usr_a", canonicalSgDeviceIdentity("NODE-A"));

    await expect(registry.findByCanonicalIdentity("device:openclaw:node-a")).resolves.toMatchObject(
      { globalId: "usr_a" },
    );
    await expect(
      registry.linkIdentity("usr_b", canonicalSgDeviceIdentity("NODE-A")),
    ).rejects.toThrow("sg-profile-identity-conflict");
  });

  it("serializes onboarding and binds only after explicit confirmation", async () => {
    const root = await fixture();
    let paired: Awaited<ReturnType<SgDeviceAccessDeps["listPairing"]>>["paired"] = [];
    const deps: SgDeviceAccessDeps = {
      now: () => 1_000_000,
      listPairing: async () => ({ pending: [], paired }),
      issueNodeBootstrap: async () => ({ token: "secret", expiresAtMs: 1_600_000 }),
    };
    const api = {
      config: { gateway: { publicOrigin: "https://sg.example" } },
      runtime: {
        version: "2026.8.1",
        state: {
          openKeyedStore: () => {
            throw new Error("untrusted-plugin-state");
          },
        },
      },
      on: vi.fn(),
    } as never;
    const alice = createSgDeviceTools(toolContext("100"), root, api, deps)[0]!;
    const bob = createSgDeviceTools(toolContext("200"), root, api, deps)[0]!;

    const connect = nativeConnect(root, deps);
    const ready = await connect();
    const target = ready.text?.match(/openclaw connect "(oc-pair:\/\/[^\"]+)" --service/)?.[1];
    expect(target).toBeDefined();
    expect(decodePairingSetupCode(target!, { nowMs: 1_000_000 })).toEqual({
      url: "wss://sg.example",
      bootstrapToken: "secret",
      expiresAtMs: 1_600_000,
    });
    expect(ready.continueAgent).not.toBe(true);
    expect(
      (await connect({ senderId: "200", from: "telegram:200", to: "telegram:200" })).text,
    ).toContain("Подключение уже начато");
    expect(details(await bob.execute("2", { action: "finish" }))).toMatchObject({
      status: "busy",
      owner: "another-user",
    });

    paired = [
      {
        deviceId: "node-a",
        publicKey: "test-public-key-a",
        displayName: "Laptop A",
        platform: "windows",
        role: "node",
        roles: ["node"],
        scopes: [],
        approvedVia: "bootstrap",
        createdAtMs: 1_000_100,
        approvedAtMs: 1_000_100,
        pendingNodeSurface: { requestId: "req-node-a", revision: "r1", ts: 1_000_100 },
      },
    ];

    expect(details(await alice.execute("3", { action: "finish" }))).toMatchObject({
      status: "confirmation-required",
      deviceId: "node-a",
    });
    await expect(
      new SgGlobalProfileRegistry(root).findByCanonicalIdentity("device:openclaw:node-a"),
    ).resolves.toBeUndefined();

    expect(details(await alice.execute("4", { action: "confirm" }))).toMatchObject({
      status: "paired",
      deviceId: "node-a",
      nodeApprovalRequestId: "req-node-a",
    });
    await expect(
      new SgGlobalProfileRegistry(root).findByCanonicalIdentity("device:openclaw:node-a"),
    ).resolves.toMatchObject({ globalId: "usr_a" });
  });

  it.each([
    { channel: "telegram", from: "telegram:group:-1001", to: "telegram:-1001" },
    { channel: "discord", from: "discord:channel:100", to: "slash:100" },
    { channel: "discord", from: "discord:group:100", to: "slash:100" },
    { channel: "slack", from: "slack:channel:C100", to: "slash:100" },
    { from: undefined },
    { senderId: undefined },
    { to: "telegram:200" },
    { isAuthorizedSender: false },
  ])("does not mint credentials on an unverified private route: %j", async (route) => {
    const root = await fixture();
    const issueNodeBootstrap = vi.fn();
    const connect = nativeConnect(root, {
      now: () => 1_000_000,
      listPairing: async () => ({ pending: [], paired: [] }),
      issueNodeBootstrap,
    });
    const result = await connect(route);
    expect(issueNodeBootstrap).not.toHaveBeenCalled();
    expect(result.text).toBeTruthy();
    expect(result.text).not.toContain("oc-pair://");
    expect(result.continueAgent).not.toBe(true);
  });

  it("uses the existing linked Global ID across native chat transports", async () => {
    const root = await fixture();
    const registry = new SgGlobalProfileRegistry(root);
    await registry.linkIdentity("usr_a", "linked:alice");
    const deps: SgDeviceAccessDeps = {
      now: () => 1_000_000,
      listPairing: async () => ({ pending: [], paired: [] }),
      issueNodeBootstrap: vi.fn(async () => ({ token: "secret", expiresAtMs: 1_600_000 })),
    };
    const config = { session: { identityLinks: { alice: ["discord:100", "slack:100"] } } };
    const connect = nativeConnect(root, deps);
    expect(
      (await connect({ channel: "discord", from: "discord:100", to: "slash:100", config })).text,
    ).toContain("openclaw connect");
    const tool = createSgDeviceTools(
      {
        config,
        messageChannel: "slack",
        requesterSenderId: "100",
      },
      root,
      { runtime: {}, on: vi.fn() },
      deps,
    )[0]!;
    expect(details(await tool.execute("finish", { action: "finish" }))).toMatchObject({
      status: "waiting",
    });
    expect(
      (await connect({ channel: "slack", from: "slack:100", to: "slash:100", config })).text,
    ).toContain("Подключение уже начато");
    expect(deps.issueNodeBootstrap).toHaveBeenCalledTimes(1);
  });

  it("returns a safe native reply on issuance failure and allows retry", async () => {
    const root = await fixture();
    const issueNodeBootstrap = vi
      .fn()
      .mockRejectedValueOnce(new Error("credential-bearing-url-must-not-escape"))
      .mockResolvedValueOnce({ token: "secret", expiresAtMs: 1_600_000 });
    const connect = nativeConnect(root, {
      now: () => 1_000_000,
      listPairing: async () => ({ pending: [], paired: [] }),
      issueNodeBootstrap,
    });
    const failure = await connect();
    expect(failure.text).toContain("Не удалось подготовить подключение");
    expect(failure.text).not.toContain("credential-bearing-url");
    expect(failure.continueAgent).not.toBe(true);
    expect((await connect()).text).toContain("openclaw connect");
  });

  it("enforces Global ID ownership for stock node tools", async () => {
    const root = await fixture();
    const registry = new SgGlobalProfileRegistry(root);
    await registry.linkIdentity("usr_a", canonicalSgDeviceIdentity("node-a"));
    await registry.linkIdentity("usr_b", canonicalSgDeviceIdentity("node-b"));

    const hooks = new Map<string, (...args: any[]) => any>();
    registerSgDeviceOwnershipPolicy(
      {
        stateDir: root,
        api: {
          config: {},
          runtime: {
            state: pluginState(),
            nodes: {
              list: async () => ({
                nodes: [
                  {
                    nodeId: "node-a",
                    connected: true,
                    caps: ["browser"],
                    commands: ["browser.proxy"],
                    nodePluginTools: [
                      {
                        name: "alice_local_tool",
                        pluginId: "local",
                        description: "local",
                        parameters: {},
                        command: "local.call",
                      },
                    ],
                  },
                  {
                    nodeId: "node-b",
                    connected: true,
                    nodePluginTools: [
                      {
                        name: "bob_local_tool",
                        pluginId: "local",
                        description: "local",
                        parameters: {},
                        command: "local.call",
                      },
                    ],
                  },
                ],
              }),
            },
          },
          on: vi.fn((name, handler) => hooks.set(name, handler)),
        } as never,
      },
      {
        listPairing: async () => ({
          pending: [],
          paired: [
            {
              deviceId: "node-a",
              publicKey: "test-public-key-a",
              role: "node",
              roles: ["node"],
              scopes: [],
              approvedVia: "bootstrap",
              createdAtMs: 1,
              approvedAtMs: 2,
              pendingNodeSurface: { requestId: "req-node-a", revision: "r1", ts: 1_000_100 },
            },
            {
              deviceId: "node-b",
              publicKey: "test-public-key-b",
              role: "node",
              roles: ["node"],
              scopes: [],
              approvedVia: "bootstrap",
              createdAtMs: 1,
              approvedAtMs: 2,
              pendingNodeSurface: { requestId: "req-node-b", revision: "r1", ts: 1_000_100 },
            },
          ],
        }),
      },
    );
    const hook = hooks.get("before_tool_call")!;
    const ctx = { requester: { channel: "telegram", senderId: "100" } };

    await expect(
      hook({ toolName: "exec", params: { host: "node", node: "node-a" } }, ctx),
    ).resolves.toBeUndefined();
    await expect(
      hook({ toolName: "exec", params: { host: "node", node: "node-b" } }, ctx),
    ).resolves.toMatchObject({ block: true });
    await expect(
      hook({ toolName: "nodes", params: { action: "status" } }, ctx),
    ).resolves.toMatchObject({ block: true });
    await expect(
      hook({ toolName: "nodes", params: { action: "approve", requestId: "req-node-a" } }, ctx),
    ).resolves.toBeUndefined();
    await expect(
      hook({ toolName: "nodes", params: { action: "approve", requestId: "req-node-b" } }, ctx),
    ).resolves.toMatchObject({ block: true });
    await expect(hook({ toolName: "browser", params: { action: "status" } }, ctx)).resolves.toEqual(
      {
        params: { action: "status", target: "node", node: "node-a" },
      },
    );
    await expect(hook({ toolName: "alice_local_tool", params: {} }, ctx)).resolves.toBeUndefined();
    await expect(hook({ toolName: "bob_local_tool", params: {} }, ctx)).resolves.toMatchObject({
      block: true,
    });
  });

  it("uses native cron creator provenance for one monarch run, without treating delivery as identity", async () => {
    const root = await fixture(true);
    const jobId = "job-a";
    const ownerSessionKey = "agent:main:telegram:direct:100";
    const sessionId = "run-a";
    const sessionKey = `agent:main:cron:${jobId}:run:${sessionId}`;
    const job = {
      id: jobId,
      enabled: true,
      agentId: "main",
      sessionTarget: "isolated",
      owner: { agentId: "main", sessionKey: ownerSessionKey, accountId: "default" },
      scheduledToolPolicy: {
        version: 1, mode: "account",
        ownerSessionKey, ownerAccountId: "default",
      },
      payload: { kind: "agentTurn", message: "audit", toolsAllow: ["exec"] },
    };
    const runData = new Map<string, unknown>();
    const hooks = new Map<string, (...args: any[]) => any>();
    const api = {
      config: {},
      runtime: {},
      runContext: {
        setRunContext: ({ runId, namespace, value }: any) => {
          runData.set(`${runId}:${namespace}`, value);
          return true;
        },
        getRunContext: ({ runId, namespace }: any) => runData.get(`${runId}:${namespace}`),
      },
      on: vi.fn((name, handler) => hooks.set(name, handler)),
    } as never;
    const current = { ...job };
    registerSgDeviceOwnershipPolicy(
      { api, stateDir: root },
      {
        listPairing: async () => ({ pending: [], paired: [] }),
        loadCronJobs: async () => ({ version: 1, jobs: [current] }) as never,
      },
    );
    const beforeRun = hooks.get("before_agent_run")!;
    const beforeTool = hooks.get("before_tool_call")!;
    const cronCtx = { trigger: "cron", jobId, runId: sessionId, sessionId,
      sessionKey, agentId: "main", channel: "telegram", accountId: "default" };
    await beforeRun({ prompt: "audit", messages: [] }, cronCtx);
    const toolCtx = { runId: sessionId, sessionId, sessionKey,
      requester: { channel: "telegram" } };
    await expect(beforeTool({ toolName: "exec", params: {} }, toolCtx))
      .resolves.toEqual({ params: { host: "gateway" } });
    await expect(beforeTool({ toolName: "exec", params: { host: "gateway" } }, toolCtx))
      .resolves.toBeUndefined();
    await expect(beforeTool({ toolName: "exec", params: { host: "node", node: "foreign" } }, toolCtx))
      .resolves.toMatchObject({ block: true });
    await expect(beforeTool({ toolName: "exec", params: {} },
      { ...toolCtx, runId: "other", sessionId: "other" }))
      .resolves.toMatchObject({ block: true });

    current.owner = { ...current.owner, sessionKey: "agent:main:telegram:group:100" };
    current.scheduledToolPolicy = { ...current.scheduledToolPolicy,
      ownerSessionKey: current.owner.sessionKey };
    await beforeRun({}, { ...cronCtx, runId: "group-run", sessionId: "group-run",
      sessionKey: "agent:main:cron:job-a:run:group-run" });
    await expect(beforeTool({ toolName: "exec", params: {} },
      { runId: "group-run", sessionId: "group-run",
        sessionKey: "agent:main:cron:job-a:run:group-run",
        requester: { channel: "telegram" } }))
      .resolves.toMatchObject({ block: true });

    current.owner = { ...current.owner, sessionKey: "agent:main:telegram:direct:200" };
    current.scheduledToolPolicy = { ...current.scheduledToolPolicy,
      ownerSessionKey: current.owner.sessionKey };
    await beforeRun({}, { ...cronCtx, runId: "citizen-run", sessionId: "citizen-run",
      sessionKey: "agent:main:cron:job-a:run:citizen-run" });
    await expect(beforeTool({ toolName: "exec", params: {} },
      { runId: "citizen-run", sessionId: "citizen-run",
        sessionKey: "agent:main:cron:job-a:run:citizen-run",
        requester: { channel: "telegram" } }))
      .resolves.toMatchObject({ block: true });
  });

  it("lists only devices owned by the current Global ID after restart", async () => {
    const root = await fixture();
    const registry = new SgGlobalProfileRegistry(root);
    await registry.linkIdentity("usr_a", canonicalSgDeviceIdentity("node-a"));
    await registry.linkIdentity("usr_b", canonicalSgDeviceIdentity("node-b"));
    const deps: SgDeviceAccessDeps = {
      now: () => Date.now(),
      issueNodeBootstrap: vi.fn(),
      listPairing: async () => ({
        pending: [],
        paired: [
          {
            deviceId: "node-a",
            publicKey: "test-public-key-a",
            displayName: "A",
            platform: "windows",
            role: "node",
            roles: ["node"],
            scopes: [],
            approvedVia: "bootstrap",
            createdAtMs: 1,
            approvedAtMs: 2,
            pendingNodeSurface: { requestId: "req-node-a", revision: "r1", ts: 1_000_100 },
          },
          {
            deviceId: "node-b",
            publicKey: "test-public-key-b",
            displayName: "B",
            platform: "linux",
            role: "node",
            roles: ["node"],
            scopes: [],
            approvedVia: "bootstrap",
            createdAtMs: 1,
            approvedAtMs: 2,
          },
        ],
      }),
    };
    const api = {
      config: {},
      runtime: {
        state: pluginState(),
        nodes: {
          list: async () => ({
            nodes: [
              { nodeId: "node-a", connected: true },
              { nodeId: "node-b", connected: true },
            ],
          }),
        },
      },
      on: vi.fn(),
    } as never;
    const tool = createSgDeviceTools(toolContext("100"), root, api, deps)[0]!;
    const result = details(await tool.execute("list", { action: "list" }));

    expect(result.status).toBe("ok");
    expect(result.devices).toEqual([
      expect.objectContaining({
        deviceId: "node-a",
        connected: true,
        nodeApprovalRequestId: "req-node-a",
      }),
    ]);
  });
});
