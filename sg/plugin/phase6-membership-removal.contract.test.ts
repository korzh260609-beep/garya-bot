import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(".");
const pluginDir = path.join(repoRoot, "sg", "plugin");
const migrationScript = path.join(repoRoot, "scripts", "sg22-migrate-workspace-memberships.mjs");
const timestamp = "2026-01-01T00:00:00.000Z";

async function stateDir() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-membership-removal-"));
  await mkdir(path.join(root, "sg"), { recursive: true });
  return root;
}

function runMigration(root: string, enabled = "true") {
  return spawnSync(process.execPath, [migrationScript], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      OPENCLAW_STATE_DIR: root,
      SG_WORKSPACE_PLUGIN_ENABLED: enabled,
    },
  });
}

function legacyStore() {
  return {
    version: 1,
    memberships: [
      {
        membershipId: "mem-1",
        workspaceId: "wsp-1",
        globalId: "usr-citizen",
        role: "member",
        status: "active",
        operationId: "op-1",
        grantedByGlobalId: "usr-owner",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    audit: [
      {
        eventId: "event-1",
        operationId: "op-1",
        action: "grant",
        workspaceId: "wsp-1",
        targetGlobalId: "usr-citizen",
        actorGlobalId: "usr-owner",
        role: "member",
        createdAt: timestamp,
      },
    ],
  };
}

async function matchingFiles(files: string[], pattern: RegExp) {
  const matches: string[] = [];
  for (const file of files) {
    try {
      if (pattern.test(await readFile(path.join(pluginDir, file), "utf8"))) matches.push(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return matches;
}

describe("SG 2.2 Phase 6 workspace membership removal", () => {
  it("removes the legacy workspace membership registry from production", async () => {
    await expect(access(path.join(pluginDir, "workspace-memberships.ts"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("does not register or expose SG membership tools", async () => {
    const offenders = await matchingFiles(
      [
        "index.ts",
        "register.ts",
        "openclaw.plugin.json",
        "loader-dispatch.probe.ts",
        "wsp4-tools.ts",
        "wsp4-diagnostics.ts",
      ],
      /sg_membership_(?:list|manage)|workspace-memberships|SgWorkspaceMembershipRegistry/u,
    );

    expect(offenders).toEqual([]);
  });

  it("allows no legacy SG membership record or role to affect WSP authorization", async () => {
    const offenders = await matchingFiles(
      [
        "wsp4-diagnostics.ts",
        "wsp5-diagnostics.ts",
        "wsp5-tools.ts",
        "wsp6-interactive.ts",
        "wsp6-tools.ts",
      ],
      /workspace-memberships|SgWorkspaceMembershipRegistry|effectiveRole|workspace-membership-required|Wsp[56]ActorRole/u,
    );

    expect(offenders).toEqual([]);
  });

  it("archives a valid legacy store before removing the active store", async () => {
    const root = await stateDir();
    const sourcePath = path.join(root, "sg", "workspace-memberships.json");
    const archivePath = path.join(root, "sg", "archive", "workspace-memberships-v1.json");
    const store = legacyStore();
    const source = JSON.stringify(store);
    await writeFile(sourcePath, source);

    const result = runMigration(root);

    expect(result.status, result.stderr).toBe(0);
    await expect(readFile(sourcePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    const archive = JSON.parse(await readFile(archivePath, "utf8"));
    expect(archive).toMatchObject({
      migrationVersion: 1,
      sourceStoreVersion: 1,
      memberships: store.memberships,
      audit: store.audit,
    });
    expect(archive.sourceChecksum).toBe(createHash("sha256").update(source).digest("hex"));
    expect(archive.legacyRecordsChecksum).toBe(
      createHash("sha256")
        .update(JSON.stringify({ memberships: store.memberships, audit: store.audit }))
        .digest("hex"),
    );

    const archiveBeforeRestart = await readFile(archivePath, "utf8");
    expect(runMigration(root).status).toBe(0);
    expect(await readFile(archivePath, "utf8")).toBe(archiveBeforeRestart);
  });

  it("fails closed on malformed legacy state without deleting or archiving it", async () => {
    const root = await stateDir();
    const sourcePath = path.join(root, "sg", "workspace-memberships.json");
    const source = JSON.stringify({ version: 1, memberships: "invalid", audit: [] });
    await writeFile(sourcePath, source);

    const result = runMigration(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("sg-workspace-membership-migration-unrecognized-store");
    expect(await readFile(sourcePath, "utf8")).toBe(source);
    await expect(
      readFile(path.join(root, "sg", "archive", "workspace-memberships-v1.json"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not touch legacy state while the SG plugin is disabled", async () => {
    const root = await stateDir();
    const sourcePath = path.join(root, "sg", "workspace-memberships.json");
    const source = JSON.stringify(legacyStore());
    await writeFile(sourcePath, source);

    const result = runMigration(root, "false");

    expect(result.status, result.stderr).toBe(0);
    expect(await readFile(sourcePath, "utf8")).toBe(source);
    await expect(
      readFile(path.join(root, "sg", "archive", "workspace-memberships-v1.json"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
