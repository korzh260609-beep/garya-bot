import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve("scripts/sg22-migrate-global-profiles.mjs");
const timestamp = "2026-01-01T00:00:00.000Z";

async function stateDir() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-role-migration-"));
  await mkdir(path.join(root, "sg"), { recursive: true });
  return root;
}

function runMigration(root: string, env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [script], {
    cwd: path.resolve("."),
    encoding: "utf8",
    env: {
      ...process.env,
      OPENCLAW_STATE_DIR: root,
      SG_WORKSPACE_PLUGIN_ENABLED: "true",
      SG_MONARCH_GLOBAL_USER_ID: "usr_monarch",
      SG_MONARCH_TELEGRAM_USER_ID: "100",
      ...env,
    },
  });
}

function profile(globalId: string, canonicalIdentity: string, role: string, status = "active") {
  return {
    globalId,
    canonicalIdentity,
    role,
    status,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function identity(canonicalIdentity: string, globalId: string) {
  return { canonicalIdentity, globalId, createdAt: timestamp, updatedAt: timestamp };
}

describe("SG 2.2 global-profile state migration", () => {
  it("does not touch persisted identity state while the SG plugin is disabled", async () => {
    const root = await stateDir();
    const source = JSON.stringify({
      version: 4,
      monarchGlobalId: "usr_monarch",
      profiles: [
        profile("usr_monarch", "channel:telegram:100", "monarch"),
        profile("usr_citizen", "channel:telegram:200", "citizen"),
      ],
      identities: [
        identity("channel:telegram:100", "usr_monarch"),
        identity("channel:telegram:200", "usr_citizen"),
      ],
      citizenRequests: [],
      audit: [],
    });
    const storePath = path.join(root, "sg", "global-profiles.json");
    await writeFile(storePath, source);

    const result = runMigration(root, {
      SG_WORKSPACE_PLUGIN_ENABLED: "false",
      SG_MONARCH_GLOBAL_USER_ID: "",
      SG_MONARCH_TELEGRAM_USER_ID: "",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(await readFile(storePath, "utf8")).toBe(source);
    await expect(
      readFile(path.join(root, "sg", "archive", "global-profiles-citizenship-v1.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves IDs, activates citizens, merges applicants and archives records", async () => {
    const root = await stateDir();
    const citizenRequests = [
      {
        requestId: "pending-1",
        canonicalIdentity: "channel:telegram:300",
        status: "pending",
        operationId: "op-1",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        requestId: "rejected-1",
        canonicalIdentity: "channel:discord:400",
        status: "rejected",
        operationId: "op-2",
        resultingGlobalId: "usr_rejected",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ];
    const audit = [
      {
        eventId: "event-1",
        operationId: "op-1",
        action: "apply",
        requestId: "pending-1",
        canonicalIdentity: "channel:telegram:300",
        createdAt: timestamp,
      },
    ];
    const source = {
      version: 4,
      monarchGlobalId: "usr_monarch",
      profiles: [
        profile("usr_monarch", "channel:telegram:100", "monarch"),
        profile("usr_guest", "channel:telegram:200", "guest", "suspended"),
        profile("usr_old_monarch", "channel:telegram:250", "monarch"),
      ],
      identities: [
        identity("channel:telegram:100", "usr_monarch"),
        identity("channel:telegram:200", "usr_guest"),
        identity("channel:telegram:250", "usr_old_monarch"),
        identity("channel:discord:200", "usr_guest"),
      ],
      citizenRequests,
      audit,
    };
    await writeFile(path.join(root, "sg", "global-profiles.json"), JSON.stringify(source));

    const result = runMigration(root);
    expect(result.status, result.stderr).toBe(0);
    const migrated = JSON.parse(
      await readFile(path.join(root, "sg", "global-profiles.json"), "utf8"),
    );
    expect(migrated).toMatchObject({ version: 5, monarchGlobalId: "usr_monarch" });
    expect(migrated.profiles).toHaveLength(5);
    expect(migrated.profiles.filter((item: { role: string }) => item.role === "monarch")).toEqual([
      expect.objectContaining({ globalId: "usr_monarch", status: "active" }),
    ]);
    expect(
      migrated.profiles.find((item: { globalId: string }) => item.globalId === "usr_guest"),
    ).toMatchObject({
      role: "citizen",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    expect(
      migrated.profiles.find((item: { globalId: string }) => item.globalId === "usr_old_monarch"),
    ).toMatchObject({ role: "citizen", status: "active" });
    expect(
      migrated.profiles.find((item: { globalId: string }) => item.globalId === "usr_rejected"),
    ).toMatchObject({ canonicalIdentity: "channel:discord:400", role: "citizen" });
    expect(
      migrated.profiles.find(
        (item: { canonicalIdentity: string }) => item.canonicalIdentity === "channel:telegram:300",
      ).globalId,
    ).toMatch(/^usr_migrated_[a-f0-9]{64}$/u);
    expect(migrated.identities).toContainEqual(identity("channel:discord:200", "usr_guest"));
    expect(migrated).not.toHaveProperty("citizenRequests");
    expect(migrated).not.toHaveProperty("audit");

    const archive = JSON.parse(
      await readFile(
        path.join(root, "sg", "archive", "global-profiles-citizenship-v1.json"),
        "utf8",
      ),
    );
    expect(archive).toMatchObject({ migrationVersion: 1, citizenRequests, audit });
    expect(archive.legacyRecordsChecksum).toBe(
      createHash("sha256").update(JSON.stringify({ citizenRequests, audit })).digest("hex"),
    );
  });

  it("is byte-stable on a second run", async () => {
    const root = await stateDir();
    await writeFile(
      path.join(root, "sg", "global-profiles.json"),
      JSON.stringify({
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
      }),
    );
    expect(runMigration(root).status).toBe(0);
    const storePath = path.join(root, "sg", "global-profiles.json");
    const archivePath = path.join(root, "sg", "archive", "global-profiles-citizenship-v1.json");
    const firstStore = await readFile(storePath, "utf8");
    const firstArchive = await readFile(archivePath, "utf8");
    const firstStoreMtime = (await stat(storePath)).mtimeMs;
    const firstArchiveMtime = (await stat(archivePath)).mtimeMs;

    expect(runMigration(root).status).toBe(0);
    expect(await readFile(storePath, "utf8")).toBe(firstStore);
    expect(await readFile(archivePath, "utf8")).toBe(firstArchive);
    expect((await stat(storePath)).mtimeMs).toBe(firstStoreMtime);
    expect((await stat(archivePath)).mtimeMs).toBe(firstArchiveMtime);
  });

  it("accepts v5 on restart without replacing the citizenship archive", async () => {
    const root = await stateDir();
    const storePath = path.join(root, "sg", "global-profiles.json");
    const archivePath = path.join(root, "sg", "archive", "global-profiles-citizenship-v1.json");
    const store = {
      version: 5,
      monarchGlobalId: "usr_monarch",
      profiles: [profile("usr_monarch", "channel:telegram:100", "monarch")],
      identities: [identity("channel:telegram:100", "usr_monarch")],
    };
    const legacyPayload = { citizenRequests: [], audit: [] };
    const archive = {
      migrationVersion: 1,
      archivedAt: timestamp,
      sourceStoreVersion: 4,
      sourceChecksum: "0".repeat(64),
      legacyRecordsChecksum: createHash("sha256")
        .update(JSON.stringify(legacyPayload))
        .digest("hex"),
      ...legacyPayload,
    };
    await mkdir(path.dirname(archivePath), { recursive: true });
    await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`);
    await writeFile(archivePath, `${JSON.stringify(archive, null, 2)}\n`);
    const archiveBeforeRestart = await readFile(archivePath, "utf8");

    const result = runMigration(root);

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(await readFile(storePath, "utf8"))).toEqual(store);
    expect(await readFile(archivePath, "utf8")).toBe(archiveBeforeRestart);
  });

  it("stops on ambiguous identity bindings without modifying the source", async () => {
    const root = await stateDir();
    const source = JSON.stringify({
      version: 4,
      monarchGlobalId: "usr_monarch",
      profiles: [
        profile("usr_monarch", "channel:telegram:100", "monarch"),
        profile("usr_one", "channel:telegram:200", "guest"),
        profile("usr_two", "channel:telegram:200", "citizen"),
      ],
      identities: [],
      citizenRequests: [],
      audit: [],
    });
    const storePath = path.join(root, "sg", "global-profiles.json");
    await writeFile(storePath, source);

    const result = runMigration(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("sg-global-profile-migration-canonical-identity-ambiguity");
    expect(await readFile(storePath, "utf8")).toBe(source);
  });

  it("stops when one Global ID is assigned to two profile identities", async () => {
    const root = await stateDir();
    const source = JSON.stringify({
      version: 4,
      monarchGlobalId: "usr_monarch",
      profiles: [
        profile("usr_monarch", "channel:telegram:100", "monarch"),
        profile("usr_conflict", "channel:telegram:200", "guest"),
        profile("usr_conflict", "channel:discord:200", "citizen"),
      ],
      identities: [],
      citizenRequests: [],
      audit: [],
    });
    const storePath = path.join(root, "sg", "global-profiles.json");
    await writeFile(storePath, source);

    const result = runMigration(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("sg-global-profile-migration-global-id-ambiguity");
    expect(await readFile(storePath, "utf8")).toBe(source);
  });

  it("stops when request and audit records disagree on a Global ID", async () => {
    const root = await stateDir();
    const request = {
      requestId: "request-conflict",
      canonicalIdentity: "channel:telegram:200",
      status: "approved",
      operationId: "operation-request",
      resultingGlobalId: "usr_request",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const audit = {
      eventId: "event-conflict",
      operationId: "operation-audit",
      action: "approve",
      requestId: "request-conflict",
      canonicalIdentity: "channel:telegram:200",
      resultingGlobalId: "usr_audit",
      createdAt: timestamp,
    };
    const source = JSON.stringify({
      version: 4,
      monarchGlobalId: "usr_monarch",
      profiles: [profile("usr_monarch", "channel:telegram:100", "monarch")],
      identities: [identity("channel:telegram:100", "usr_monarch")],
      citizenRequests: [request],
      audit: [audit],
    });
    const storePath = path.join(root, "sg", "global-profiles.json");
    await writeFile(storePath, source);

    const result = runMigration(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("sg-global-profile-migration-request-global-id-ambiguity");
    expect(await readFile(storePath, "utf8")).toBe(source);
  });

  it("fails closed on invalid JSON without rebuilding the store", async () => {
    const root = await stateDir();
    const source = "{invalid";
    const storePath = path.join(root, "sg", "global-profiles.json");
    await writeFile(storePath, source);

    const result = runMigration(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("sg-global-profile-migration-invalid-json");
    expect(await readFile(storePath, "utf8")).toBe(source);
  });
});
