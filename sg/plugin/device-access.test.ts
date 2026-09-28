import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { OpenClawPluginToolContext } from "openclaw/plugin-sdk/plugin-entry";
import {
  canonicalSgDeviceIdentity,
  createSgDeviceTools,
  registerSgDeviceOwnershipPolicy,
  type SgDeviceAccessDeps,
} from "./device-access.js";
import { SgGlobalProfileRegistry } from "./global-profile-registry.js";

const timestamp = "2026-01-01T00:00:00.000Z";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-device-"));
  await mkdir(path.join(root, "sg"), { recursive: true });
  await writeFile(
    path.join(root, "sg", "global-profiles.json"),
    JSON.stringify({
      version: 5,
      profiles: [
        {
          globalId: "usr_a",
          canonicalIdentity: "channel:telegram:100",
          role: "citizen",
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

describe("SG device access", () => {
  it("stores OpenClaw device ownership in the existing Global ID identity registry", async () => {
    const root = await fixture();
    const registry = new SgGlobalProfileRegistry(root);

    await registry.linkIdentity("usr_a", canonicalSgDeviceIdentity("NODE-A"));

    await expect(
      registry.findByCanonicalIdentity("device:openclaw:node-a"),
    ).resolves.toMatchObject({ globalId: "usr_a" });
    await expect(
      registry.linkIdentity("usr_b", canonicalSgDeviceIdentity("NODE-A")),
    ).rejects.toThrow("sg-profile-identity-conflict");
  });

  it("serializes onboarding and binds only after explicit confirmation", async () => {
    const root = await fixture();
    let paired: any[] = [];
    const deps: SgDeviceAccessDeps = {
      now: () => 1_000_000,
      listPairing: async () => ({ pending: [], paired }),
      issueNodeBootstrap: async () => ({ token: "secret", expiresAtMs: 1_600_000 }),
    };
    const api = {
      config: { gateway: { publicOrigin: "https://sg.example" } },
      runtime: { version: "2026.8.1", state: pluginState() },
      on: vi.fn(),
    } as never;
    const alice = createSgDeviceTools(toolContext("100"), root, api, deps)[0]!;
    const bob = createSgDeviceTools(toolContext("200"), root, api, deps)[0]!;

    expect(details(await alice.execute("1", { action: "connect" }))).toMatchObject({
      status: "ready",
      command: expect.stringContaining("openclaw@2026.8.1 connect"),
    });
    expect(details(await bob.execute("2", { action: "connect" }))).toMatchObject({
      status: "busy",
      owner: "another-user",
    });

    paired = [
      {
        deviceId: "node-a",
        displayName: "Laptop A",
        platform: "windows",
        role: "node",
        roles: ["node"],
        scopes: [],
        approvedVia: "bootstrap",
        createdAtMs: 1_000_100,
        approvedAtMs: 1_000_100,
        pendingNodeSurface: { requestId: "req-node-a" },
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

  it("enforces Global ID ownership for stock node tools", async () => {
    const root = await fixture();
    const registry = new SgGlobalProfileRegistry(root);
    await registry.linkIdentity("usr_a", canonicalSgDeviceIdentity("node-a"));
    await registry.linkIdentity("usr_b", canonicalSgDeviceIdentity("node-b"));

    const hooks = new Map<string, (...args: any[]) => any>();
    registerSgDeviceOwnershipPolicy({
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
    }, {
      listPairing: async () => ({
        pending: [],
        paired: [
          {
            deviceId: "node-a",
            role: "node",
            roles: ["node"],
            scopes: [],
            approvedVia: "bootstrap",
            createdAtMs: 1,
            approvedAtMs: 2,
            pendingNodeSurface: { requestId: "req-node-a" },
          },
          {
            deviceId: "node-b",
            role: "node",
            roles: ["node"],
            scopes: [],
            approvedVia: "bootstrap",
            createdAtMs: 1,
            approvedAtMs: 2,
            pendingNodeSurface: { requestId: "req-node-b" },
          },
        ],
      }),
    });
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
    await expect(
      hook({ toolName: "browser", params: { action: "status" } }, ctx),
    ).resolves.toEqual({
      params: { action: "status", target: "node", node: "node-a" },
    });
    await expect(
      hook({ toolName: "alice_local_tool", params: {} }, ctx),
    ).resolves.toBeUndefined();
    await expect(
      hook({ toolName: "bob_local_tool", params: {} }, ctx),
    ).resolves.toMatchObject({ block: true });
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
            displayName: "A",
            platform: "windows",
            role: "node",
            roles: ["node"],
            scopes: [],
            approvedVia: "bootstrap",
            createdAtMs: 1,
            approvedAtMs: 2,
            pendingNodeSurface: { requestId: "req-node-a" },
          },
          {
            deviceId: "node-b",
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
