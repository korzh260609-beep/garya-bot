import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import { SgGlobalProfileRegistry, validateGlobalProfileStore } from "./citizenship-registry.js";
import { resolveWorkspaceContext } from "./context.js";
import { SgWorkspaceRegistry } from "./workspace-registry.js";

const timestamp = "2026-01-01T00:00:00.000Z";
const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(pluginDir, "../..");

type TargetWorkspaceContext = Awaited<ReturnType<typeof resolveWorkspaceContext>> & {
  personalWorkspaceId?: string;
  personalWorkspaceRoot?: string;
};

async function createStateDir() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-role-contract-"));
  await mkdir(path.join(root, "sg"), { recursive: true });
  return realpath(root);
}

async function writeProfileStore(
  root: string,
  profiles: Array<{
    globalId: string;
    canonicalIdentity: string;
    role: "guest" | "citizen" | "monarch";
  }> = [],
) {
  await writeFile(
    path.join(root, "sg", "global-profiles.json"),
    JSON.stringify({
      version: 3,
      profiles: profiles.map((profile) => ({
        ...profile,
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
      identities: profiles.map((profile) => ({
        canonicalIdentity: profile.canonicalIdentity,
        globalId: profile.globalId,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
      citizenRequests: [],
      audit: [],
    }),
    "utf8",
  );
}

async function snapshot(root: string) {
  return new SgGlobalProfileRegistry(root).snapshot();
}

async function readDevelopmentPolicySources(): Promise<string> {
  const files: string[] = [
    path.join(repoRoot, "Dockerfile.sg22-overlay"),
    path.join(repoRoot, "scripts", "sg22-render-entrypoint.sh"),
  ];
  const queue = [path.join(repoRoot, "sg")];
  while (queue.length > 0) {
    const directory = queue.shift();
    if (!directory) continue;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "workspace") queue.push(target);
      } else if (
        !entry.name.endsWith(".test.ts") &&
        [".ts", ".json", ".yaml", ".yml"].includes(path.extname(entry.name))
      ) {
        files.push(target);
      }
    }
  }
  return (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
}

describe("SG 2.2 canonical role model contract", () => {
  it("keeps the configured GARY identity on the same monarch Global ID", async () => {
    const root = await createStateDir();
    await writeProfileStore(root, [
      {
        globalId: "usr_monarch",
        canonicalIdentity: "channel:telegram:100",
        role: "monarch",
      },
    ]);

    const first = await resolveWorkspaceContext(
      { channel: "telegram", senderId: "100", to: "telegram:100" },
      root,
    );
    const second = await resolveWorkspaceContext(
      { channel: "telegram", senderId: "100", to: "telegram:-100500" },
      root,
    );

    assert.equal(first.globalId, "usr_monarch");
    assert.equal(second.globalId, "usr_monarch");
    assert.equal(first.projectRole, "monarch");
    assert.equal(second.projectRole, "monarch");
  });

  it("creates one active citizen on another person's first valid contact", async () => {
    const root = await createStateDir();

    const first = await resolveWorkspaceContext(
      { channel: "telegram", senderId: "200", to: "telegram:200" },
      root,
    );
    const second = await resolveWorkspaceContext(
      { channel: "telegram", senderId: "200", to: "telegram:200" },
      root,
    );
    const store = await snapshot(root);

    assert.equal(first.projectRole, "citizen");
    assert.equal(second.globalId, first.globalId);
    assert.ok(first.globalId);
    assert.equal(store.profiles.length, 1);
    assert.deepEqual(store.profiles[0], {
      ...store.profiles[0],
      globalId: first.globalId,
      canonicalIdentity: "channel:telegram:200",
      role: "citizen",
      status: "active",
    });
  });

  it("serializes concurrent first contacts into one profile and one Global ID", async () => {
    const root = await createStateDir();

    const contexts = await Promise.all(
      Array.from({ length: 8 }, () =>
        resolveWorkspaceContext({ channel: "telegram", senderId: "201", to: "telegram:201" }, root),
      ),
    );
    const ids = new Set(contexts.map((context) => context.globalId));
    const store = await snapshot(root);

    assert.equal(ids.size, 1);
    assert.ok(contexts[0]?.globalId);
    assert.equal(store.profiles.length, 1);
    assert.equal(store.identities.length, 1);
  });

  it("reuses one Global ID for linked identities across transports", async () => {
    const root = await createStateDir();
    const identityLinks = { gary_friend: ["telegram:202", "discord:abc"] };

    const telegram = await resolveWorkspaceContext(
      { channel: "telegram", senderId: "202", to: "telegram:202", identityLinks },
      root,
    );
    const discord = await resolveWorkspaceContext(
      { channel: "discord", senderId: "abc", to: "discord:abc", identityLinks },
      root,
    );

    assert.ok(telegram.globalId);
    assert.equal(discord.globalId, telegram.globalId);
    assert.equal((await snapshot(root)).profiles.length, 1);
  });

  it("creates neither an active guest nor a citizenship request", async () => {
    const root = await createStateDir();

    const context = await resolveWorkspaceContext(
      { channel: "telegram", senderId: "203", to: "telegram:203" },
      root,
    );
    const store = await snapshot(root);

    assert.equal(context.projectRole, "citizen");
    assert.equal(
      store.profiles.some((profile) => profile.role === "guest"),
      false,
    );
    assert.equal(store.version, 5);
    assert.equal("citizenRequests" in store, false);
    assert.equal("audit" in store, false);
  });

  it("rejects persisted or runtime attempts to create a second monarch", () => {
    const storeWithTwoMonarchs = {
      version: 3,
      profiles: ["100", "200"].map((senderId) => ({
        globalId: `usr_${senderId}`,
        canonicalIdentity: `channel:telegram:${senderId}`,
        role: "monarch",
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
      identities: ["100", "200"].map((senderId) => ({
        globalId: `usr_${senderId}`,
        canonicalIdentity: `channel:telegram:${senderId}`,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
      citizenRequests: [],
      audit: [],
    };

    assert.equal(validateGlobalProfileStore(storeWithTwoMonarchs), false);
  });

  it("derives the personal workspace root only from the trusted Global ID", async () => {
    const personalWorkspace = (await import("./personal-workspace.js")) as {
      resolvePersonalWorkspaceRoot: (stateDir: string, globalId: string) => string;
    };
    const root = await createStateDir();

    assert.equal(
      personalWorkspace.resolvePersonalWorkspaceRoot(root, "usr_citizen"),
      path.join(root, "sg", "users", "usr_citizen"),
    );
    for (const invalidGlobalId of ["../usr_monarch", "/usr_monarch", "usr\\monarch", "..", ""]) {
      assert.throws(
        () => personalWorkspace.resolvePersonalWorkspaceRoot(root, invalidGlobalId),
        /global-id|invalid|path/iu,
      );
    }
  });

  it("uses the same personal workspace for one linked person across transports", async () => {
    const root = await createStateDir();
    const identityLinks = { linked_person: ["telegram:204", "discord:def"] };

    const telegram = (await resolveWorkspaceContext(
      { channel: "telegram", senderId: "204", identityLinks },
      root,
    )) as TargetWorkspaceContext;
    const discord = (await resolveWorkspaceContext(
      { channel: "discord", senderId: "def", identityLinks },
      root,
    )) as TargetWorkspaceContext;

    assert.ok(telegram.personalWorkspaceRoot);
    assert.equal(discord.personalWorkspaceRoot, telegram.personalWorkspaceRoot);
    assert.equal(telegram.personalWorkspaceId, telegram.globalId);
    assert.equal(discord.personalWorkspaceId, telegram.globalId);
  });

  it("keeps personal state in the same workspace after restart", async () => {
    const root = await createStateDir();
    const first = (await resolveWorkspaceContext(
      { channel: "telegram", senderId: "205" },
      root,
    )) as TargetWorkspaceContext;
    assert.ok(first.personalWorkspaceRoot);
    await mkdir(first.personalWorkspaceRoot, { recursive: true });
    await writeFile(path.join(first.personalWorkspaceRoot, "restart-marker"), "preserved", "utf8");

    const afterRestart = (await resolveWorkspaceContext(
      { channel: "telegram", senderId: "205" },
      root,
    )) as TargetWorkspaceContext;

    assert.equal(afterRestart.personalWorkspaceRoot, first.personalWorkspaceRoot);
    assert.equal(
      await readFile(path.join(afterRestart.personalWorkspaceRoot, "restart-marker"), "utf8"),
      "preserved",
    );
  });

  it("isolates personal workspaces for two Global IDs", async () => {
    const root = await createStateDir();
    const first = (await resolveWorkspaceContext(
      { channel: "telegram", senderId: "206" },
      root,
    )) as TargetWorkspaceContext;
    const second = (await resolveWorkspaceContext(
      { channel: "telegram", senderId: "207" },
      root,
    )) as TargetWorkspaceContext;

    assert.ok(first.personalWorkspaceRoot);
    assert.ok(second.personalWorkspaceRoot);
    assert.notEqual(first.globalId, second.globalId);
    assert.notEqual(first.personalWorkspaceRoot, second.personalWorkspaceRoot);
    await mkdir(first.personalWorkspaceRoot, { recursive: true });
    await writeFile(path.join(first.personalWorkspaceRoot, "private-marker"), "first", "utf8");
    await assert.rejects(readFile(path.join(second.personalWorkspaceRoot, "private-marker")));
  });

  it("creates a neutral group resource scope with no SG role or owner", async () => {
    const root = await createStateDir();
    const registry = new SgWorkspaceRegistry(root);
    const scope = (await registry.register({
      platform: "telegram",
      accountId: "default",
      resourceId: "telegram:-100500",
      resourceKind: "group",
      title: "Neutral scope",
    } as never)) as unknown as Record<string, unknown>;

    assert.equal(typeof scope.resourceScopeId, "string");
    assert.equal("workspaceId" in scope, false);
    assert.equal("ownerGlobalId" in scope, false);
    assert.equal("status" in scope, false);
    assert.equal("role" in scope, false);
  });

  it("does not accept caller-selected personal or resource scope identifiers", async () => {
    const sources = await Promise.all(
      ["wsp5-tools.ts", "wsp6-tools.ts"].map((file) =>
        readFile(path.join(pluginDir, file), "utf8"),
      ),
    );
    const source = sources.join("\n");

    assert.doesNotMatch(source, /workspaceId\s*:\s*\{\s*type:\s*["']string["']/u);
    assert.doesNotMatch(source, /typeof\s+params\.workspaceId/u);
    assert.doesNotMatch(source, /params\.(?:globalId|resourceScopeId)/u);
  });

  it("default-denies development tool discovery and invocation for non-Monarch senders", async () => {
    const source = await readDevelopmentPolicySources();

    assert.match(source, /toolsBySender/u);
    assert.match(source, /["']\*["']/u);
    for (const denied of ["exec", "process", "write", "edit", "apply_patch", "subagents"]) {
      assert.match(source, new RegExp(`deny[\\s\\S]*["']${denied}["']`, "u"));
    }
  });

  it("keeps Monarch development access under native approvals and sandboxing", async () => {
    const source = await readDevelopmentPolicySources();

    assert.match(source, /toolsBySender/u);
    assert.match(source, /channel:telegram:/u);
    assert.doesNotMatch(source, /approvalPolicy\s*[:=]\s*["']never["']/iu);
    assert.doesNotMatch(
      source,
      /sandbox(?:Mode|_mode)?\s*[:=]\s*["'](?:off|disabled|danger-full-access)["']/iu,
    );
  });
});
