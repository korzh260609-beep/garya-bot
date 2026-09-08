import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { registerWorkspaceManager } from "./register.js";

const repoRoot = path.resolve(".");
const legacyCitizenshipTools = [
  "sg_citizen_apply",
  "sg_citizen_pending",
  "sg_citizen_decide",
] as const;
const currentPluginTools = [
  "sg_content_draft",
  "sg_content_review",
  "sg_content_publish",
  "sg_content_schedule",
  "sg_content_dispatch",
  "sg_test_manage",
  "sg_test_attempt",
  "sg_test_stats",
  "sg_memory_remember",
  "sg_memory_search",
  "sg_memory_get",
  "sg_render",
] as const;

function readShellJsonArray(source: string, variable: string): string[] {
  const match = source.match(new RegExp(`^\\s*${variable}='([^']*)'$`, "mu"));
  expect(match, `${variable} must be a literal JSON array`).not.toBeNull();
  return JSON.parse(match?.[1] ?? "[]") as string[];
}

function readSenderPolicies(source: string) {
  const match = source.match(/^\s*workspace_sender_tools="(.+)"$/mu);
  expect(match, "workspace_sender_tools must be literal JSON").not.toBeNull();
  return JSON.parse(
    (match?.[1] ?? "{}").replaceAll('\\"', '"').replaceAll("${telegram_owner_id}", "100"),
  ) as Record<string, { allow?: string[]; alsoAllow?: string[]; deny?: string[] }>;
}

const migrationScripts = [
  "sg22-migrate-global-profiles.mjs",
  "sg22-migrate-workspace-memberships.mjs",
  "sg22-migrate-workspace-requests.mjs",
  "sg22-migrate-wsp5-content.mjs",
  "sg22-migrate-wsp6-assessments.mjs",
] as const;

function runMigrationChain(root: string) {
  return migrationScripts.map((script) =>
    spawnSync(process.execPath, [path.join(repoRoot, "scripts", script)], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        OPENCLAW_STATE_DIR: root,
        SG_WORKSPACE_PLUGIN_ENABLED: "true",
        SG_MONARCH_GLOBAL_USER_ID: "usr_monarch",
        SG_MONARCH_TELEGRAM_USER_ID: "100",
      },
    }),
  );
}

describe("SG 2.2 Phase 12 verification matrix", () => {
  it("exposes only the current SG tools through the runtime allowlist", async () => {
    const entrypoint = await readFile(
      path.join(repoRoot, "scripts", "sg22-render-entrypoint.sh"),
      "utf8",
    );
    const allowed = readShellJsonArray(entrypoint, "workspace_plugin_tools");

    expect(allowed).toEqual(currentPluginTools);
    for (const obsolete of legacyCitizenshipTools) {
      expect(allowed).not.toContain(obsolete);
    }
  });

  it("does not preserve obsolete citizenship tools in the entrypoint contract", async () => {
    const contract = await readFile(
      path.join(repoRoot, "test", "scripts", "sg22-render-entrypoint.test.ts"),
      "utf8",
    );

    for (const obsolete of legacyCitizenshipTools) {
      expect(contract).not.toContain(obsolete);
    }
  });

  it("denies development tools to citizens and native admins but not the Monarch", async () => {
    const entrypoint = await readFile(
      path.join(repoRoot, "scripts", "sg22-render-entrypoint.sh"),
      "utf8",
    );
    const policies = readSenderPolicies(entrypoint);
    const citizen = policies["*"];
    // Native Telegram owner/admin/member status is intentionally absent from SG policy keys.
    const nativeAdmin = policies["*"];
    const monarch = policies["channel:telegram:100"];

    expect(nativeAdmin).toEqual(citizen);
    expect(Object.keys(policies)).toEqual(["*", "channel:telegram:100"]);
    for (const denied of [
      "read",
      "write",
      "edit",
      "apply_patch",
      "exec",
      "process",
      "github_publish",
      "sessions_spawn",
      "subagents",
    ]) {
      expect(citizen?.deny).toContain(denied);
      expect(nativeAdmin?.deny).toContain(denied);
      expect(monarch?.deny ?? []).not.toContain(denied);
    }
  });

  it("runs migrations twice without drift and restores the verified backup", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "sg-phase12-state-"));
    const backupRoot = await mkdtemp(path.join(os.tmpdir(), "sg-phase12-backup-"));
    const sgDir = path.join(root, "sg");
    const backupSgDir = path.join(backupRoot, "sg");
    const storePath = path.join(sgDir, "global-profiles.json");
    const archivePath = path.join(sgDir, "archive", "global-profiles-citizenship-v1.json");
    const timestamp = "2026-01-01T00:00:00.000Z";
    const source = JSON.stringify({
      version: 3,
      profiles: [
        {
          globalId: "usr_monarch",
          canonicalIdentity: "channel:telegram:100",
          role: "monarch",
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          globalId: "usr_guest",
          canonicalIdentity: "channel:telegram:200",
          role: "guest",
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
        {
          canonicalIdentity: "channel:telegram:200",
          globalId: "usr_guest",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      citizenRequests: [],
      audit: [],
    });
    await mkdir(sgDir, { recursive: true });
    await writeFile(storePath, source);
    await cp(sgDir, backupSgDir, { recursive: true, preserveTimestamps: true });

    for (const result of runMigrationChain(root)) {
      expect(result.status, result.stderr).toBe(0);
    }
    const firstStore = await readFile(storePath, "utf8");
    const firstArchive = await readFile(archivePath, "utf8");
    for (const result of runMigrationChain(root)) {
      expect(result.status, result.stderr).toBe(0);
    }
    expect(await readFile(storePath, "utf8")).toBe(firstStore);
    expect(await readFile(archivePath, "utf8")).toBe(firstArchive);

    await rm(sgDir, { recursive: true });
    await cp(backupSgDir, sgDir, { recursive: true, preserveTimestamps: true });
    expect(await readFile(storePath, "utf8")).toBe(source);
    await expect(stat(archivePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("observes a normal Telegram group message without claiming its reply", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "sg-phase12-reply-"));
    const hooks = new Map<string, (...args: unknown[]) => unknown>();
    registerWorkspaceManager({
      registerCommand: vi.fn(),
      registerTool: vi.fn(),
      on: vi.fn((name, handler) => hooks.set(name, handler)),
      runtime: { state: { resolveStateDir: () => root } },
    });
    const hook = hooks.get("before_dispatch");
    expect(hook).toBeDefined();

    await expect(
      hook?.(
        { content: "СГ, привет", isGroup: true, channel: "telegram", senderId: "200" },
        {
          sessionKey: "agent:main:telegram:group:-100500",
          channelId: "telegram",
          accountId: "default",
          conversationId: "telegram:-100500",
          senderId: "200",
        },
      ),
    ).resolves.toEqual({ handled: false });
  });
});
