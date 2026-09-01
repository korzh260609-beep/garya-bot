import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SgWorkspaceMembershipRegistry } from "./workspace-memberships.js";
import { SgWorkspaceRegistry } from "./workspace-registry.js";

const timestamp = "2026-01-01T00:00:00.000Z";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-wsp4-member-"));
  await mkdir(path.join(root, "sg"), { recursive: true });
  const profiles = [
    ["usr_monarch", "100", "monarch"],
    ["usr_owner_a", "101", "citizen"],
    ["usr_owner_b", "102", "citizen"],
    ["usr_member", "200", "citizen"],
  ].map(([globalId, sender, role]) => ({
    globalId,
    canonicalIdentity: `channel:telegram:${sender}`,
    role,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
  await writeFile(
    path.join(root, "sg", "global-profiles.json"),
    JSON.stringify({
      version: 3,
      profiles,
      identities: profiles.map((profile) => ({
        canonicalIdentity: profile.canonicalIdentity,
        globalId: profile.globalId,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
      citizenRequests: [],
      audit: [],
    }),
  );
  const workspaces = new SgWorkspaceRegistry(root);
  const workspaceA = await workspaces.register({
    platform: "telegram",
    accountId: "default",
    resourceId: "group-a",
    resourceKind: "group",
    title: "A",
    ownerGlobalId: "usr_owner_a",
    status: "active",
    settings: {},
  });
  const workspaceB = await workspaces.register({
    platform: "telegram",
    accountId: "default",
    resourceId: "group-b",
    resourceKind: "group",
    title: "B",
    ownerGlobalId: "usr_owner_b",
    status: "active",
    settings: {},
  });
  return { root, workspaces, workspaceA, workspaceB };
}

describe("SG WSP4 workspace memberships", () => {
  it("does not turn an active citizen into a workspace member automatically", async () => {
    const { root, workspaceA } = await fixture();
    const registry = new SgWorkspaceMembershipRegistry(root);
    await expect(registry.effectiveRole(workspaceA.workspaceId, "usr_member")).resolves.toBeUndefined();
  });

  it("grants in one workspace without leaking into another and survives restart", async () => {
    const { root, workspaceA, workspaceB } = await fixture();
    const registry = new SgWorkspaceMembershipRegistry(root);
    const result = await registry.grant({
      actorGlobalId: "usr_owner_a",
      workspaceId: workspaceA.workspaceId,
      targetGlobalId: "usr_member",
      role: "member",
    });
    expect(result.status).toBe("granted");
    await expect(registry.effectiveRole(workspaceA.workspaceId, "usr_member")).resolves.toBe("member");
    await expect(registry.effectiveRole(workspaceB.workspaceId, "usr_member")).resolves.toBeUndefined();
    const restarted = new SgWorkspaceMembershipRegistry(root);
    await expect(restarted.effectiveRole(workspaceA.workspaceId, "usr_member")).resolves.toBe("member");
  });

  it("allows monarch management and records exactly one audit event per change", async () => {
    const { root, workspaceA } = await fixture();
    const registry = new SgWorkspaceMembershipRegistry(root);
    await registry.grant({
      actorGlobalId: "usr_monarch",
      workspaceId: workspaceA.workspaceId,
      targetGlobalId: "usr_member",
      role: "admin",
    });
    const duplicate = await registry.grant({
      actorGlobalId: "usr_monarch",
      workspaceId: workspaceA.workspaceId,
      targetGlobalId: "usr_member",
      role: "admin",
    });
    expect(duplicate.status).toBe("already_active");
    expect((await registry.snapshot()).audit).toHaveLength(1);
  });

  it("rejects management by an unrelated citizen without mutation", async () => {
    const { root, workspaceA } = await fixture();
    const registry = new SgWorkspaceMembershipRegistry(root);
    await expect(
      registry.grant({
        actorGlobalId: "usr_owner_b",
        workspaceId: workspaceA.workspaceId,
        targetGlobalId: "usr_member",
        role: "member",
      }),
    ).rejects.toThrow("sg-workspace-membership-manager-required");
    expect((await registry.snapshot()).memberships).toHaveLength(0);
  });

  it("revokes only workspace membership while preserving global citizenship", async () => {
    const { root, workspaceA } = await fixture();
    const registry = new SgWorkspaceMembershipRegistry(root);
    await registry.grant({
      actorGlobalId: "usr_owner_a",
      workspaceId: workspaceA.workspaceId,
      targetGlobalId: "usr_member",
      role: "member",
    });
    const revoked = await registry.revoke({
      actorGlobalId: "usr_owner_a",
      workspaceId: workspaceA.workspaceId,
      targetGlobalId: "usr_member",
    });
    expect(revoked.status).toBe("revoked");
    await expect(registry.effectiveRole(workspaceA.workspaceId, "usr_member")).resolves.toBeUndefined();
    const snapshot = await registry.snapshot();
    expect(snapshot.audit.map((event) => event.action)).toEqual(["grant", "revoke"]);
  });

  it("blocks mutation in a suspended workspace", async () => {
    const { root, workspaces, workspaceA } = await fixture();
    await workspaces.setStatus(workspaceA.workspaceId, "suspended");
    const registry = new SgWorkspaceMembershipRegistry(root);
    await expect(
      registry.grant({
        actorGlobalId: "usr_monarch",
        workspaceId: workspaceA.workspaceId,
        targetGlobalId: "usr_member",
        role: "member",
      }),
    ).rejects.toThrow("sg-workspace-not-active");
  });

  it("fails closed for a malformed membership store", async () => {
    const { root } = await fixture();
    await writeFile(path.join(root, "sg", "workspace-memberships.json"), "{}");
    await expect(new SgWorkspaceMembershipRegistry(root).snapshot()).rejects.toThrow(
      "sg-workspace-membership-store-invalid",
    );
  });
});
