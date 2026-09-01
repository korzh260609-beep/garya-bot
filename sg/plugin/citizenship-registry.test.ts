import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SgGlobalProfileRegistry } from "./citizenship-registry.js";

const timestamp = "2026-01-01T00:00:00.000Z";

async function stateDir() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-wsp4-citizen-"));
  await mkdir(path.join(root, "sg"), { recursive: true });
  return root;
}

async function seedMonarch(root: string, version: 2 | 3 = 3) {
  await writeFile(
    path.join(root, "sg", "global-profiles.json"),
    JSON.stringify({
      version,
      profiles: [
        {
          globalId: "usr_monarch",
          canonicalIdentity: "channel:telegram:100",
          role: "monarch",
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
      ],
      ...(version === 3 ? { citizenRequests: [], audit: [] } : {}),
    }),
  );
}

describe("SG WSP4 citizenship registry", () => {
  it("creates an idempotent pending application without creating a profile", async () => {
    const root = await stateDir();
    await seedMonarch(root);
    const registry = new SgGlobalProfileRegistry(root);
    const first = await registry.apply("channel:telegram:200");
    const second = await registry.apply("channel:telegram:200");
    expect(second.request?.requestId).toBe(first.request?.requestId);
    const snapshot = await registry.snapshot();
    expect(snapshot.citizenRequests).toHaveLength(1);
    expect(snapshot.audit).toHaveLength(1);
    expect(snapshot.profiles).toHaveLength(1);
    await expect(registry.findByCanonicalIdentity("channel:telegram:200")).resolves.toBeUndefined();
  });

  it("atomically approves into an active citizen and survives restart", async () => {
    const root = await stateDir();
    await seedMonarch(root);
    const registry = new SgGlobalProfileRegistry(root);
    const applied = await registry.apply("channel:telegram:200");
    const decided = await registry.decide({
      actorGlobalId: "usr_monarch",
      requestId: applied.request?.requestId ?? "",
      decision: "approve",
    });
    expect(decided.request.status).toBe("approved");
    expect(decided.profile).toMatchObject({ role: "citizen", status: "active" });
    const restarted = new SgGlobalProfileRegistry(root);
    await expect(restarted.findByCanonicalIdentity("channel:telegram:200")).resolves.toMatchObject({
      globalId: decided.profile?.globalId,
      role: "citizen",
    });
    const snapshot = await restarted.snapshot();
    expect(snapshot.audit.map((event) => event.action)).toEqual(["apply", "approve"]);
    expect(snapshot.audit.at(-1)?.operationId).toBe(snapshot.citizenRequests[0]?.operationId);
  });

  it("rejects without granting citizenship", async () => {
    const root = await stateDir();
    await seedMonarch(root);
    const registry = new SgGlobalProfileRegistry(root);
    const applied = await registry.apply("channel:telegram:201");
    await registry.decide({
      actorGlobalId: "usr_monarch",
      requestId: applied.request?.requestId ?? "",
      decision: "reject",
    });
    await expect(registry.findByCanonicalIdentity("channel:telegram:201")).resolves.toBeUndefined();
    expect((await registry.snapshot()).citizenRequests[0]?.status).toBe("rejected");
  });

  it("enforces monarch authorization inside the registry", async () => {
    const root = await stateDir();
    await seedMonarch(root);
    const registry = new SgGlobalProfileRegistry(root);
    const applied = await registry.apply("channel:telegram:202");
    await expect(
      registry.decide({
        actorGlobalId: "usr_unknown",
        requestId: applied.request?.requestId ?? "",
        decision: "approve",
      }),
    ).rejects.toThrow("sg-citizen-monarch-required");
    expect((await registry.snapshot()).citizenRequests[0]?.status).toBe("pending");
  });

  it("serializes concurrent applications for one canonical identity", async () => {
    const root = await stateDir();
    await seedMonarch(root);
    const first = new SgGlobalProfileRegistry(root);
    const second = new SgGlobalProfileRegistry(root);
    const results = await Promise.all([
      first.apply("channel:telegram:203"),
      second.apply("channel:telegram:203"),
    ]);
    expect(new Set(results.map((result) => result.request?.requestId)).size).toBe(1);
    expect((await first.snapshot()).citizenRequests).toHaveLength(1);
  });

  it("accepts v2 and upgrades it on the first mutation", async () => {
    const root = await stateDir();
    await seedMonarch(root, 2);
    const registry = new SgGlobalProfileRegistry(root);
    await expect(registry.findByGlobalId("usr_monarch")).resolves.toMatchObject({ role: "monarch" });
    await registry.apply("channel:telegram:204");
    const persisted = JSON.parse(
      await readFile(path.join(root, "sg", "global-profiles.json"), "utf8"),
    );
    expect(persisted).toMatchObject({ version: 3 });
    expect(persisted.citizenRequests).toHaveLength(1);
  });

  it("fails closed for malformed state", async () => {
    const root = await stateDir();
    await writeFile(path.join(root, "sg", "global-profiles.json"), "{}");
    await expect(new SgGlobalProfileRegistry(root).snapshot()).rejects.toThrow(
      "sg-global-profile-store-invalid",
    );
  });
});
