import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatWorkspaceResolution, SgWorkspaceRegistry } from "./workspace-registry.js";

const registration = (resourceId: string, resourceKind: "group" | "channel" = "group") => ({
  platform: "telegram",
  accountId: "default",
  resourceId,
  resourceKind,
});

async function createRegistry() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-resource-scope-"));
  return { root, registry: new SgWorkspaceRegistry(root) };
}

describe("SG neutral resource scopes", () => {
  it("isolates two groups and one channel", async () => {
    const { registry } = await createRegistry();
    const groupA = await registry.register(registration("group-a"));
    const groupB = await registry.register(registration("group-b"));
    const channel = await registry.register(registration("channel-a", "channel"));
    expect(
      new Set([groupA.resourceScopeId, groupB.resourceScopeId, channel.resourceScopeId]).size,
    ).toBe(3);
    await expect(
      registry.resolve({ platform: "telegram", accountId: "default", resourceId: "group-a" }),
    ).resolves.toEqual(groupA);
  });

  it("isolates a forum topic from its parent group", async () => {
    const { registry } = await createRegistry();
    const parent = await registry.register(registration("group-a"));
    const topic = await registry.register({
      ...registration("group-a"),
      topicId: "42",
      parentResourceId: "group-a",
      resourceKind: "topic",
    });
    expect(topic.resourceScopeId).not.toBe(parent.resourceScopeId);
    await expect(
      registry.resolve({
        platform: "telegram",
        accountId: "default",
        resourceId: "group-a",
        topicId: "42",
      }),
    ).resolves.toEqual(topic);
  });

  it("is idempotent for the same normalized platform resource", async () => {
    const { registry } = await createRegistry();
    const first = await registry.register({ ...registration("group-a"), platform: "TELEGRAM" });
    const second = await registry.register({ ...registration(" group-a ") });
    expect(second.resourceScopeId).toBe(first.resourceScopeId);
  });

  it("serializes concurrent registrations without losing a scope", async () => {
    const { registry } = await createRegistry();
    const [groupA, groupB] = await Promise.all([
      registry.register(registration("group-a")),
      registry.register(registration("group-b")),
    ]);
    await expect(
      registry.resolve({ platform: "telegram", accountId: "default", resourceId: "group-a" }),
    ).resolves.toEqual(groupA);
    await expect(
      registry.resolve({ platform: "telegram", accountId: "default", resourceId: "group-b" }),
    ).resolves.toEqual(groupB);
  });

  it("persists a neutral scope across a simulated restart", async () => {
    const { root, registry } = await createRegistry();
    const created = await registry.register(registration("group-a"));
    const restarted = new SgWorkspaceRegistry(root);
    await expect(
      restarted.resolve({ platform: "telegram", accountId: "default", resourceId: "group-a" }),
    ).resolves.toEqual(created);
  });

  it("fails safely for an unregistered resource", async () => {
    const { registry } = await createRegistry();
    await expect(
      registry.resolve({ platform: "telegram", resourceId: "unknown" }),
    ).resolves.toBeUndefined();
    expect(formatWorkspaceResolution(undefined)).toContain("не зарегистрирован");
  });

  it("fails closed for an invalid registry instead of resetting it", async () => {
    const { root, registry } = await createRegistry();
    await mkdir(path.join(root, "sg"));
    await writeFile(path.join(root, "sg", "workspaces.json"), "{}");
    await expect(registry.resolve({ platform: "telegram", resourceId: "group-a" })).rejects.toThrow(
      "sg-resource-scope-store-invalid",
    );
  });
});
