import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SgWorkspaceRegistry } from "./workspace-registry.js";
import { Wsp5NativeLifecycle } from "./wsp5-lifecycle.js";
import { createWsp5Tools } from "./wsp5-tools.js";

const repoRoot = path.resolve(".");
const pluginDir = path.join(repoRoot, "sg", "plugin");
const migrationScript = path.join(repoRoot, "scripts", "sg22-migrate-wsp5-content.mjs");
const timestamp = "2026-01-01T00:00:00.000Z";
const identityLinks = {
  alice: ["telegram:20", "discord:alice"],
  bob: ["telegram:30"],
};

async function stateDir() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-wsp5-scope-migration-"));
  await mkdir(path.join(root, "sg"), { recursive: true });
  await writeFile(
    path.join(root, "sg", "global-profiles.json"),
    JSON.stringify({
      version: 5,
      monarchGlobalId: "usr_monarch",
      profiles: [
        {
          globalId: "usr_monarch",
          canonicalIdentity: "channel:telegram:10",
          role: "monarch",
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          globalId: "usr_alice",
          canonicalIdentity: "linked:alice",
          role: "citizen",
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          globalId: "usr_bob",
          canonicalIdentity: "linked:bob",
          role: "citizen",
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      identities: [
        {
          canonicalIdentity: "channel:telegram:10",
          globalId: "usr_monarch",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          canonicalIdentity: "linked:alice",
          globalId: "usr_alice",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          canonicalIdentity: "linked:bob",
          globalId: "usr_bob",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    }),
  );
  return root;
}

function toolContext(input: {
  channel: string;
  senderId: string;
  target: string;
  sessionKey: string;
  topicId?: string;
}) {
  return {
    config: { session: { identityLinks } },
    messageChannel: input.channel,
    agentAccountId: "default",
    nativeChannelId: input.target,
    requesterSenderId: input.senderId,
    sessionKey: input.sessionKey,
    ...(input.topicId ? { deliveryContext: { threadId: input.topicId } } : {}),
  };
}

function details(result: unknown): Record<string, unknown> {
  return (result as { details: Record<string, unknown> }).details;
}

function findTool(tools: ReturnType<typeof createWsp5Tools>, name: string) {
  const tool = tools.find((item) => item.name === name);
  if (!tool) {
    throw new Error(`missing tool ${name}`);
  }
  return tool;
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

function legacyContentStore(workspaceId = "wsp-legacy") {
  return {
    version: 1,
    drafts: [
      {
        draftId: "draft-legacy",
        workspaceId,
        creatorGlobalId: "usr_alice",
        text: "Legacy material",
        media: [],
        highImpact: false,
        revision: 1,
        editorialStatus: "draft",
        deliveryStatus: "none",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    publications: [
      {
        publicationId: "publication-legacy",
        operationId: "operation-publish",
        draftId: "draft-legacy",
        workspaceId,
        revision: 1,
        mode: "now",
        platform: "telegram",
        target: "telegram:-100500",
        nativeResultId: "message-legacy",
        status: "published",
        createdAt: timestamp,
      },
    ],
    audit: [
      {
        eventId: "event-legacy",
        operationId: "operation-create",
        action: "create",
        draftId: "draft-legacy",
        workspaceId,
        actorGlobalId: "usr_alice",
        fromEditorial: "draft",
        toEditorial: "draft",
        fromDelivery: "none",
        toDelivery: "none",
        createdAt: timestamp,
      },
    ],
  };
}

async function writeResourceScopes(root: string) {
  await writeFile(
    path.join(root, "sg", "workspaces.json"),
    JSON.stringify({
      version: 2,
      resourceScopes: [
        {
          resourceScopeId: "wsp-legacy",
          platform: "telegram",
          accountId: "default",
          resourceKind: "group",
          resourceId: "telegram:-100500",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    }),
  );
}

describe("SG 2.2 Phase 8 WSP5 personal/resource scopes", () => {
  it("removes caller-selected scope parameters and internal SG role gates from WSP5", async () => {
    const [tools, registry, lifecycle] = await Promise.all(
      ["wsp5-tools.ts", "content-registry.ts", "wsp5-lifecycle.ts"].map((file) =>
        readFile(path.join(pluginDir, file), "utf8"),
      ),
    );

    expect(tools).not.toMatch(/workspaceId\s*:\s*\{\s*type:\s*["']string["']/u);
    expect(tools).not.toMatch(/topicId\s*:\s*\{\s*type:/u);
    expect(tools).not.toMatch(/params\.(?:workspaceId|resourceScopeId|globalId|topicId)/u);
    expect(tools).not.toMatch(/projectRole|canManage|requireEditor|workspace\.status/u);
    expect(registry).not.toMatch(/\bworkspaceId\b/u);
    expect(registry).not.toMatch(/\bcanManage\b/u);
    expect(lifecycle).not.toMatch(/\bSgWorkspace\b|workspace\.settings/u);
  });

  it("creates isolated personal drafts from the trusted Global ID and reuses linked identity", async () => {
    const root = await stateDir();
    const aliceTelegram = createWsp5Tools(
      toolContext({
        channel: "telegram",
        senderId: "20",
        target: "telegram:20",
        sessionKey: "telegram-alice",
      }),
      root,
      new Wsp5NativeLifecycle(undefined as never),
    );
    const created = details(
      await findTool(aliceTelegram, "sg_content_draft").execute("create-personal", {
        action: "create",
        text: "Alice private draft",
      }),
    );
    expect(created).toMatchObject({ status: "created", draft: { creatorGlobalId: "usr_alice" } });
    expect(created.draft).not.toHaveProperty("workspaceId");

    const bob = createWsp5Tools(
      toolContext({
        channel: "telegram",
        senderId: "30",
        target: "telegram:30",
        sessionKey: "telegram-bob",
      }),
      root,
      new Wsp5NativeLifecycle(undefined as never),
    );
    const bobList = details(
      await findTool(bob, "sg_content_draft").execute("list-bob", { action: "list" }),
    );
    expect(bobList).toEqual({ status: "ok", drafts: [] });

    const aliceDiscord = createWsp5Tools(
      toolContext({
        channel: "discord",
        senderId: "alice",
        target: "discord:alice",
        sessionKey: "discord-alice",
      }),
      root,
      new Wsp5NativeLifecycle(undefined as never),
    );
    const aliceList = details(
      await findTool(aliceDiscord, "sg_content_draft").execute("list-alice", { action: "list" }),
    );
    expect(aliceList).toMatchObject({ status: "ok", drafts: [{ draftId: expect.any(String) }] });
  });

  it("derives shared content scope only from the trusted current resource and topic", async () => {
    const root = await stateDir();
    const scopes = new SgWorkspaceRegistry(root);
    const group = await scopes.register({
      platform: "telegram",
      accountId: "default",
      resourceKind: "group",
      resourceId: "telegram:-100500",
    });
    const tools = createWsp5Tools(
      toolContext({
        channel: "telegram",
        senderId: "20",
        target: "telegram:-100500",
        topicId: "42",
        sessionKey: "group-topic-42",
      }),
      root,
      new Wsp5NativeLifecycle(undefined as never),
    );
    const created = details(
      await findTool(tools, "sg_content_draft").execute("create-topic", {
        action: "create",
        text: "Topic-only draft",
      }),
    );

    expect(created).toMatchObject({ status: "created" });
    expect(created.draft).not.toHaveProperty("workspaceId");
    expect(JSON.stringify(created.draft)).toContain("resourceScopeId");
    expect(JSON.stringify(created.draft)).not.toContain(group.resourceScopeId);
  });

  it("denies draft access when the current trusted resource does not own it", async () => {
    const root = await stateDir();
    const scopes = new SgWorkspaceRegistry(root);
    await scopes.register({
      platform: "telegram",
      accountId: "default",
      resourceKind: "group",
      resourceId: "telegram:-100500",
    });
    await scopes.register({
      platform: "telegram",
      accountId: "default",
      resourceKind: "group",
      resourceId: "telegram:-100600",
    });
    const groupA = createWsp5Tools(
      toolContext({
        channel: "telegram",
        senderId: "20",
        target: "telegram:-100500",
        sessionKey: "group-a",
      }),
      root,
      new Wsp5NativeLifecycle(undefined as never),
    );
    const created = details(
      await findTool(groupA, "sg_content_draft").execute("create-a", {
        action: "create",
        text: "Group A draft",
      }),
    );
    const draftId = (created.draft as { draftId: string }).draftId;
    const groupB = createWsp5Tools(
      toolContext({
        channel: "telegram",
        senderId: "20",
        target: "telegram:-100600",
        sessionKey: "group-b",
      }),
      root,
      new Wsp5NativeLifecycle(undefined as never),
    );
    const result = details(
      await findTool(groupB, "sg_content_draft").execute("get-cross-resource", {
        action: "get",
        draftId,
      }),
    );

    expect(result.status).toBe("denied");
  });

  it("places WSP5 management behind native sender-specific tool policy", async () => {
    const entrypoint = await readFile(
      path.join(repoRoot, "scripts", "sg22-render-entrypoint.sh"),
      "utf8",
    );

    expect(entrypoint).toContain('"path":"tools.toolsBySender"');
    expect(entrypoint).toMatch(/channel:telegram:\$\{telegram_owner_id\}/u);
    for (const tool of ["sg_content_review", "sg_content_publish", "sg_content_schedule"]) {
      expect(entrypoint).toMatch(new RegExp(`toolsBySender[\\s\\S]*${tool}`, "u"));
    }
  });

  it("archives and migrates legacy WSP5 records to resource-scope references", async () => {
    const root = await stateDir();
    await writeResourceScopes(root);
    const sourcePath = path.join(root, "sg", "content.json");
    const archivePath = path.join(root, "sg", "archive", "content-v1.json");
    const source = JSON.stringify(legacyContentStore());
    await writeFile(sourcePath, source);

    const result = runMigration(root);

    expect(result.status, result.stderr).toBe(0);
    const archive = JSON.parse(await readFile(archivePath, "utf8"));
    expect(archive).toMatchObject({
      migrationVersion: 1,
      sourceStoreVersion: 1,
      drafts: [{ draftId: "draft-legacy", workspaceId: "wsp-legacy" }],
      publications: [{ publicationId: "publication-legacy" }],
      audit: [{ eventId: "event-legacy" }],
    });
    expect(archive.sourceChecksum).toBe(createHash("sha256").update(source).digest("hex"));

    const migrated = JSON.parse(await readFile(sourcePath, "utf8"));
    expect(migrated.version).toBe(2);
    expect(JSON.stringify(migrated)).not.toContain("workspaceId");
    expect(JSON.stringify(migrated)).toContain('"resourceScopeId":"wsp-legacy"');
    expect(migrated.drafts[0].draftId).toBe("draft-legacy");
    expect(migrated.publications[0].nativeResultId).toBe("message-legacy");
    expect(migrated.audit[0].eventId).toBe("event-legacy");

    const beforeRestart = await readFile(sourcePath, "utf8");
    expect(runMigration(root).status).toBe(0);
    expect(await readFile(sourcePath, "utf8")).toBe(beforeRestart);
  });

  it("fails closed when a legacy WSP5 workspace cannot map to a resource scope", async () => {
    const root = await stateDir();
    await writeResourceScopes(root);
    const sourcePath = path.join(root, "sg", "content.json");
    const source = JSON.stringify(legacyContentStore("wsp-unmapped"));
    await writeFile(sourcePath, source);

    const result = runMigration(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("sg-wsp5-content-migration-unmapped-scope");
    expect(await readFile(sourcePath, "utf8")).toBe(source);
  });

  it("does not migrate WSP5 state while the SG plugin is disabled", async () => {
    const root = await stateDir();
    await writeResourceScopes(root);
    const sourcePath = path.join(root, "sg", "content.json");
    const source = JSON.stringify(legacyContentStore());
    await writeFile(sourcePath, source);

    const result = runMigration(root, "false");

    expect(result.status, result.stderr).toBe(0);
    expect(await readFile(sourcePath, "utf8")).toBe(source);
  });

  it("packages and runs WSP5 migration after resource-scope migration", async () => {
    const [dockerfile, entrypoint] = await Promise.all([
      readFile(path.join(repoRoot, "Dockerfile.sg22-overlay"), "utf8"),
      readFile(path.join(repoRoot, "scripts", "sg22-render-entrypoint.sh"), "utf8"),
    ]);
    const resourceMigration = entrypoint.indexOf(
      "node /app/scripts/sg22-migrate-workspace-requests.mjs",
    );
    const contentMigration = entrypoint.indexOf("node /app/scripts/sg22-migrate-wsp5-content.mjs");

    expect(dockerfile).toContain("sg22-migrate-wsp5-content.mjs");
    expect(contentMigration).toBeGreaterThan(resourceMigration);
  });
});
