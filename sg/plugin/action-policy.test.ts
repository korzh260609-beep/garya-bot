import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { afterEach, describe, expect, it } from "vitest";
import { registerSgActionPolicy } from "./action-policy.js";

const roots: string[] = [];

async function fixture() {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), "sg-action-policy-"));
  roots.push(stateDir);
  const profilePath = path.join(stateDir, "sg", "global-profiles.json");
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
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          globalId: "usr_citizen",
          canonicalIdentity: "channel:telegram:200",
          role: "citizen",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      identities: [
        {
          canonicalIdentity: "channel:telegram:100",
          globalId: "usr_monarch",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          canonicalIdentity: "channel:telegram:200",
          globalId: "usr_citizen",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    }),
  );
  const hooks = new Map<string, Array<(event: any, ctx: any) => unknown>>();
  const api = {
    config: {},
    on(name: string, handler: (event: any, ctx: any) => unknown) {
      hooks.set(name, [...(hooks.get(name) ?? []), handler]);
    },
  } as unknown as OpenClawPluginApi;
  registerSgActionPolicy({ api, stateDir });
  const invoke = async (toolName: string, action: string, senderId: string) => {
    const handler = hooks.get("before_tool_call")?.[0];
    if (!handler) {
      throw new Error("before_tool_call hook missing");
    }
    return handler(
      { toolName, params: { action } },
      { requester: { channel: "telegram", senderId } },
    );
  };
  return { hooks, invoke };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("SG action policy", () => {
  it("blocks a citizen from privileged SG tools before execution", async () => {
    const { invoke, hooks } = await fixture();

    await expect(invoke("sg_render", "status", "200")).resolves.toEqual({
      block: true,
      blockReason: "SG monarch Global ID is required",
    });
    await expect(invoke("sg_test_manage", "list", "200")).resolves.toEqual({
      block: true,
      blockReason: "SG monarch Global ID is required",
    });
    for (const stop of hooks.get("gateway_stop") ?? []) {
      await stop({}, {});
    }
  });

  it("uses native approval for Render and billing mutations", async () => {
    const { invoke, hooks } = await fixture();

    await expect(invoke("sg_render", "deploy_commit", "100")).resolves.toMatchObject({
      requireApproval: {
        severity: "critical",
        allowedDecisions: ["allow-once", "deny"],
      },
    });
    await expect(invoke("sg_billing_manage", "credit", "100")).resolves.toMatchObject({
      requireApproval: {
        severity: "critical",
        allowedDecisions: ["allow-once", "deny"],
      },
    });
    await expect(invoke("sg_render", "status", "100")).resolves.toBeUndefined();
    for (const stop of hooks.get("gateway_stop") ?? []) {
      await stop({}, {});
    }
  });
});
