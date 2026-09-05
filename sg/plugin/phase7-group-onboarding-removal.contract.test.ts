import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { registerWorkspaceManager } from "./register.js";
import { SgWorkspaceRegistry } from "./workspace-registry.js";

const repoRoot = path.resolve(".");
const pluginDir = path.join(repoRoot, "sg", "plugin");
const migrationScript = path.join(repoRoot, "scripts", "sg22-migrate-workspace-requests.mjs");
const timestamp = "2026-01-01T00:00:00.000Z";

async function stateDir() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-group-onboarding-removal-"));
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
    requests: [
      {
        requestId: "wreq-pending",
        platform: "telegram",
        accountId: "default",
        resourceId: "telegram:-100500",
        resourceKind: "group",
        title: "Pending group",
        initiatorCanonicalIdentity: "channel:telegram:200",
        initiatorGlobalId: "usr-citizen",
        status: "pending",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        requestId: "wreq-rejected",
        platform: "telegram",
        accountId: "default",
        resourceId: "telegram:-100600",
        resourceKind: "group",
        title: "Rejected group",
        initiatorCanonicalIdentity: "channel:telegram:300",
        initiatorGlobalId: "usr-other-citizen",
        status: "rejected",
        decidedByGlobalId: "usr-monarch",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
  };
}

function legacyWorkspaceStore() {
  return {
    version: 1,
    workspaces: [
      {
        workspaceId: "wsp-existing",
        platform: "telegram",
        accountId: "default",
        resourceId: "telegram:-100700",
        resourceKind: "group",
        title: "Existing group",
        ownerGlobalId: "usr-old-owner",
        status: "active",
        settings: {},
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
  };
}

async function matchingFiles(files: string[], pattern: RegExp) {
  const matches: string[] = [];
  for (const file of files) {
    try {
      if (pattern.test(await readFile(path.join(repoRoot, file), "utf8"))) {
        matches.push(file);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
  return matches;
}

describe("SG 2.2 Phase 7 group onboarding removal", () => {
  it("removes the legacy workspace request registry from production", async () => {
    await expect(access(path.join(pluginDir, "workspace-requests.ts"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("does not register, expose or prompt for SG group onboarding decisions", async () => {
    const offenders = await matchingFiles(
      [
        "sg/plugin/index.ts",
        "sg/plugin/register.ts",
        "sg/plugin/workspace-tools.ts",
        "sg/plugin/openclaw.plugin.json",
        "scripts/sg22-render-entrypoint.sh",
      ],
      /sg_workspace_(?:onboard|pending|decide)|SgWorkspaceRequestRegistry|(?:from|export)[^\n]*workspace-requests|WSP3_AGENT_GUIDANCE|ONBOARDING_NOTICE|PENDING_NOTICE/u,
    );

    expect(offenders).toEqual([]);
  });

  it("creates an idempotent neutral resource scope from an admitted group route", async () => {
    const root = await stateDir();
    const hooks = new Map<string, (...args: unknown[]) => unknown>();
    registerWorkspaceManager({
      registerCommand: vi.fn(),
      registerTool: vi.fn(),
      on: vi.fn((name, handler) => hooks.set(name, handler)),
      runtime: { state: { resolveStateDir: () => root } },
    } as never);
    const event = { isGroup: true, channel: "telegram", senderId: "200" };
    const context = {
      messageId: "message-1",
      sessionKey: "agent:main:telegram:group:-100500",
      channelId: "telegram",
      accountId: "default",
      conversationId: "telegram:-100500",
      senderId: "200",
    };

    await expect(hooks.get("before_dispatch")?.(event, context)).resolves.toEqual({
      handled: false,
    });
    const registry = new SgWorkspaceRegistry(root);
    const first = (await registry.resolve({
      platform: "telegram",
      accountId: "default",
      resourceId: "telegram:-100500",
    })) as unknown as Record<string, unknown>;
    await hooks.get("before_dispatch")?.(event, { ...context, messageId: "message-2" });
    const second = (await registry.resolve({
      platform: "telegram",
      accountId: "default",
      resourceId: "telegram:-100500",
    })) as unknown as Record<string, unknown>;

    expect(typeof first.resourceScopeId).toBe("string");
    expect(second.resourceScopeId).toBe(first.resourceScopeId);
    expect(first).not.toHaveProperty("workspaceId");
    expect(first).not.toHaveProperty("ownerGlobalId");
    expect(first).not.toHaveProperty("status");
    expect(first).not.toHaveProperty("role");
    await expect(
      readFile(path.join(root, "sg", "workspace-requests.json"), "utf8"),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("archives valid pending and rejected requests before removing the active store", async () => {
    const root = await stateDir();
    const sourcePath = path.join(root, "sg", "workspace-requests.json");
    const archivePath = path.join(root, "sg", "archive", "workspace-requests-v1.json");
    const workspacePath = path.join(root, "sg", "workspaces.json");
    const workspaceArchivePath = path.join(root, "sg", "archive", "workspaces-v1.json");
    const store = legacyStore();
    const workspaceStore = legacyWorkspaceStore();
    const source = JSON.stringify(store);
    await writeFile(sourcePath, source);
    await writeFile(workspacePath, JSON.stringify(workspaceStore));

    const result = runMigration(root);

    expect(result.status, result.stderr).toBe(0);
    await expect(readFile(sourcePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    const archive = JSON.parse(await readFile(archivePath, "utf8"));
    expect(archive).toMatchObject({
      migrationVersion: 1,
      sourceStoreVersion: 1,
      requests: store.requests,
    });
    expect(archive.sourceChecksum).toBe(createHash("sha256").update(source).digest("hex"));
    expect(archive.legacyRecordsChecksum).toBe(
      createHash("sha256")
        .update(JSON.stringify({ requests: store.requests }))
        .digest("hex"),
    );
    expect(JSON.parse(await readFile(workspaceArchivePath, "utf8"))).toMatchObject({
      migrationVersion: 1,
      sourceStoreVersion: 1,
      workspaces: workspaceStore.workspaces,
    });
    const migratedWorkspaceStore = JSON.parse(await readFile(workspacePath, "utf8"));
    expect(migratedWorkspaceStore).toEqual({
      version: 2,
      resourceScopes: [
        {
          resourceScopeId: "wsp-existing",
          platform: "telegram",
          accountId: "default",
          resourceKind: "group",
          resourceId: "telegram:-100700",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    });
    expect(JSON.stringify(migratedWorkspaceStore)).not.toContain("ownerGlobalId");
    expect(JSON.stringify(migratedWorkspaceStore)).not.toContain("status");

    const archiveBeforeRestart = await readFile(archivePath, "utf8");
    const workspaceBeforeRestart = await readFile(workspacePath, "utf8");
    expect(runMigration(root).status).toBe(0);
    expect(await readFile(archivePath, "utf8")).toBe(archiveBeforeRestart);
    expect(await readFile(workspacePath, "utf8")).toBe(workspaceBeforeRestart);
  });

  it("fails closed on malformed legacy requests without deleting or archiving them", async () => {
    const root = await stateDir();
    const sourcePath = path.join(root, "sg", "workspace-requests.json");
    const source = JSON.stringify({ version: 1, requests: "invalid" });
    await writeFile(sourcePath, source);

    const result = runMigration(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("sg-workspace-request-migration-unrecognized-store");
    expect(await readFile(sourcePath, "utf8")).toBe(source);
    await expect(
      readFile(path.join(root, "sg", "archive", "workspace-requests-v1.json"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not touch legacy requests while the SG plugin is disabled", async () => {
    const root = await stateDir();
    const sourcePath = path.join(root, "sg", "workspace-requests.json");
    const source = JSON.stringify(legacyStore());
    await writeFile(sourcePath, source);

    const result = runMigration(root, "false");

    expect(result.status, result.stderr).toBe(0);
    expect(await readFile(sourcePath, "utf8")).toBe(source);
    await expect(
      readFile(path.join(root, "sg", "archive", "workspace-requests-v1.json"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("packages and runs the request migration before OpenClaw startup", async () => {
    const [dockerfile, entrypoint] = await Promise.all([
      readFile(path.join(repoRoot, "Dockerfile.sg22-overlay"), "utf8"),
      readFile(path.join(repoRoot, "scripts", "sg22-render-entrypoint.sh"), "utf8"),
    ]);
    const membershipMigration = entrypoint.indexOf(
      "node /app/scripts/sg22-migrate-workspace-memberships.mjs",
    );
    const requestMigration = entrypoint.indexOf(
      "node /app/scripts/sg22-migrate-workspace-requests.mjs",
    );

    expect(dockerfile).toContain("sg22-migrate-workspace-requests.mjs");
    expect(requestMigration).toBeGreaterThan(membershipMigration);
  });
});
