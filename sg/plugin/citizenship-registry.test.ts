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

function profile(globalId: string, canonicalIdentity: string, role: string) {
  return {
    globalId,
    canonicalIdentity,
    role,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function identity(canonicalIdentity: string, globalId: string) {
  return { canonicalIdentity, globalId, createdAt: timestamp, updatedAt: timestamp };
}

async function seedStore(root: string, value: unknown) {
  await writeFile(path.join(root, "sg", "global-profiles.json"), JSON.stringify(value));
}

describe("SG global profile registry", () => {
  it("upgrades an active legacy guest to citizen without changing the Global ID", async () => {
    const root = await stateDir();
    await seedStore(root, {
      version: 3,
      profiles: [
        profile("usr_monarch", "channel:telegram:100", "monarch"),
        profile("usr_guest", "channel:telegram:200", "guest"),
      ],
      identities: [
        identity("channel:telegram:100", "usr_monarch"),
        identity("channel:telegram:200", "usr_guest"),
      ],
      citizenRequests: [],
      audit: [],
    });
    const registry = new SgGlobalProfileRegistry(root);

    await expect(registry.ensureProfile("channel:telegram:200")).resolves.toMatchObject({
      globalId: "usr_guest",
      role: "citizen",
      status: "active",
    });
    const persisted = JSON.parse(
      await readFile(path.join(root, "sg", "global-profiles.json"), "utf8"),
    );
    expect(persisted).toMatchObject({ version: 5, monarchGlobalId: "usr_monarch" });
    expect(persisted).not.toHaveProperty("citizenRequests");
    expect(persisted).not.toHaveProperty("audit");
  });

  it("creates a citizen directly without an application record", async () => {
    const root = await stateDir();
    const registry = new SgGlobalProfileRegistry(root);

    const created = await registry.ensureProfile("channel:telegram:200");
    const snapshot = await registry.snapshot();

    expect(created).toMatchObject({ role: "citizen", status: "active" });
    expect(snapshot).toMatchObject({ version: 5, profiles: [created] });
    expect(snapshot).not.toHaveProperty("citizenRequests");
    expect(snapshot).not.toHaveProperty("audit");
  });

  it("returns one stable profile for repeated first-contact resolution", async () => {
    const root = await stateDir();
    const registry = new SgGlobalProfileRegistry(root);

    const first = await registry.ensureProfile("channel:telegram:200");
    const second = await registry.ensureProfile("channel:telegram:200");

    expect(second).toEqual(first);
    expect((await registry.snapshot()).profiles).toHaveLength(1);
  });

  it("serializes concurrent first-contact creation", async () => {
    const root = await stateDir();
    const first = new SgGlobalProfileRegistry(root);
    const second = new SgGlobalProfileRegistry(root);

    const profiles = await Promise.all([
      first.ensureProfile("channel:telegram:200"),
      second.ensureProfile("channel:telegram:200"),
    ]);

    expect(new Set(profiles.map((item) => item.globalId)).size).toBe(1);
    expect((await first.snapshot()).profiles).toHaveLength(1);
  });

  it("preserves the v5 profile across restart", async () => {
    const root = await stateDir();
    const created = await new SgGlobalProfileRegistry(root).ensureProfile("channel:telegram:200");

    await expect(
      new SgGlobalProfileRegistry(root).findByCanonicalIdentity("channel:telegram:200"),
    ).resolves.toEqual(created);
  });

  it("reads a canonical v5 store without adding legacy fields", async () => {
    const root = await stateDir();
    await seedStore(root, {
      version: 5,
      monarchGlobalId: "usr_monarch",
      profiles: [profile("usr_monarch", "channel:telegram:100", "monarch")],
      identities: [identity("channel:telegram:100", "usr_monarch")],
    });

    const snapshot = await new SgGlobalProfileRegistry(root).snapshot();

    expect(snapshot.version).toBe(5);
    expect(snapshot).not.toHaveProperty("citizenRequests");
    expect(snapshot).not.toHaveProperty("audit");
  });

  it("accepts an empty legacy store and writes only the v5 runtime contract", async () => {
    const root = await stateDir();
    await seedStore(root, {
      version: 4,
      monarchGlobalId: "usr_monarch",
      profiles: [profile("usr_monarch", "channel:telegram:100", "monarch")],
      identities: [identity("channel:telegram:100", "usr_monarch")],
      citizenRequests: [],
      audit: [],
    });
    const registry = new SgGlobalProfileRegistry(root);

    await registry.ensureProfile("channel:telegram:200");
    const persisted = JSON.parse(
      await readFile(path.join(root, "sg", "global-profiles.json"), "utf8"),
    );

    expect(persisted.version).toBe(5);
    expect(persisted).not.toHaveProperty("citizenRequests");
    expect(persisted).not.toHaveProperty("audit");
  });

  it("fails closed when legacy citizenship records were not archived", async () => {
    const root = await stateDir();
    await seedStore(root, {
      version: 4,
      monarchGlobalId: "usr_monarch",
      profiles: [profile("usr_monarch", "channel:telegram:100", "monarch")],
      identities: [identity("channel:telegram:100", "usr_monarch")],
      citizenRequests: [
        {
          requestId: "request-1",
          canonicalIdentity: "channel:telegram:200",
          status: "pending",
          operationId: "operation-1",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      audit: [],
    });

    await expect(new SgGlobalProfileRegistry(root).snapshot()).rejects.toThrow(
      "sg-global-profile-store-invalid",
    );
  });

  it("fails closed when legacy citizenship audit was not archived", async () => {
    const root = await stateDir();
    await seedStore(root, {
      version: 4,
      monarchGlobalId: "usr_monarch",
      profiles: [profile("usr_monarch", "channel:telegram:100", "monarch")],
      identities: [identity("channel:telegram:100", "usr_monarch")],
      citizenRequests: [],
      audit: [
        {
          eventId: "event-1",
          operationId: "operation-1",
          action: "apply",
          requestId: "request-1",
          canonicalIdentity: "channel:telegram:200",
          createdAt: timestamp,
        },
      ],
    });

    await expect(new SgGlobalProfileRegistry(root).snapshot()).rejects.toThrow(
      "sg-global-profile-store-invalid",
    );
  });

  it("fails closed for malformed state", async () => {
    const root = await stateDir();
    await seedStore(root, {});
    await expect(new SgGlobalProfileRegistry(root).snapshot()).rejects.toThrow(
      "sg-global-profile-store-invalid",
    );
  });
});
