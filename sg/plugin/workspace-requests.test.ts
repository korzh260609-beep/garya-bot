import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SgWorkspaceRegistry } from "./workspace-registry.js";
import { SgWorkspaceRequestRegistry } from "./workspace-requests.js";

async function createRegistries() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-wsp3-"));
  await mkdir(path.join(root, "sg"), { recursive: true });
  await writeFile(
    path.join(root, "sg", "global-profiles.json"),
    JSON.stringify({
      version: 2,
      profiles: [
        {
          globalId: "usr_owner",
          canonicalIdentity: "channel:telegram:300",
          role: "citizen",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      identities: [
        {
          canonicalIdentity: "channel:telegram:300",
          globalId: "usr_owner",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    }),
  );
  return {
    requests: new SgWorkspaceRequestRegistry(root),
    workspaces: new SgWorkspaceRegistry(root),
  };
}

describe("SG Workspace Manager WSP3 onboarding", () => {
  it("records the person who encountered SG only as initiator", async () => {
    const { requests } = await createRegistries();
    const request = await requests.create({
      platform: "telegram",
      accountId: "default",
      resourceId: "group-a",
      resourceKind: "group",
      title: "Group A",
      initiatorCanonicalIdentity: "channel:telegram:200",
      initiatorGlobalId: "usr_citizen",
    });
    expect(request).toMatchObject({
      status: "pending",
      initiatorGlobalId: "usr_citizen",
    });
    expect(request).not.toHaveProperty("ownerGlobalId");
  });

  it("is idempotent for repeated discovery of the same resource", async () => {
    const { requests } = await createRegistries();
    const input = {
      platform: "telegram",
      resourceId: "group-a",
      resourceKind: "group" as const,
      title: "Group A",
      initiatorCanonicalIdentity: "channel:telegram:200",
    };
    const first = await requests.create(input);
    const second = await requests.create(input);
    expect(second.requestId).toBe(first.requestId);
  });

  it("requires a separately confirmed owner before workspace activation", async () => {
    const { requests, workspaces } = await createRegistries();
    const request = await requests.create({
      platform: "telegram",
      resourceId: "group-a",
      resourceKind: "group",
      title: "Group A",
      initiatorCanonicalIdentity: "channel:telegram:200",
      initiatorGlobalId: "usr_initiator",
    });
    await expect(
      requests.approve({
        requestId: request.requestId,
        decidedByGlobalId: "usr_monarch",
        ownerGlobalId: "usr_owner",
        workspaces,
      }),
    ).resolves.toMatchObject({
      request: {
        status: "approved",
        initiatorGlobalId: "usr_initiator",
        ownerGlobalId: "usr_owner",
        authoritySource: "monarch_confirmation",
      },
      workspace: { status: "active", ownerGlobalId: "usr_owner" },
    });
  });

  it("keeps the request pending until the real owner has an active SG profile", async () => {
    const { requests, workspaces } = await createRegistries();
    const request = await requests.create({
      platform: "telegram",
      resourceId: "group-a",
      resourceKind: "group",
      title: "Group A",
      initiatorCanonicalIdentity: "channel:telegram:200",
    });
    await expect(
      requests.approve({
        requestId: request.requestId,
        decidedByGlobalId: "usr_monarch",
        ownerGlobalId: "usr_unknown",
        workspaces,
      }),
    ).rejects.toThrow("sg-workspace-owner-profile-not-active");
    await expect(requests.listPending()).resolves.toHaveLength(1);
  });

  it("rejects without creating a workspace", async () => {
    const { requests, workspaces } = await createRegistries();
    const request = await requests.create({
      platform: "telegram",
      resourceId: "group-a",
      resourceKind: "group",
      title: "Group A",
      initiatorCanonicalIdentity: "channel:telegram:200",
    });
    await expect(
      requests.reject({ requestId: request.requestId, decidedByGlobalId: "usr_monarch" }),
    ).resolves.toMatchObject({ status: "rejected" });
    await expect(
      workspaces.resolve({ platform: "telegram", resourceId: "group-a" }),
    ).resolves.toBeUndefined();
  });
});
