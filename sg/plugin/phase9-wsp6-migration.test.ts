import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { openSgAssessmentStores, SgAssessmentRegistry } from "./wsp6-assessments.js";

const repoRoot = path.resolve(".");
const migrationScript = path.join(repoRoot, "scripts", "sg22-migrate-wsp6-assessments.mjs");
const timestamp = "2026-01-01T00:00:00.000Z";

async function stateDir() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-wsp6-migration-"));
  await mkdir(path.join(root, "sg"), { recursive: true });
  return root;
}

function legacyDefinition(resourceScopeId = "wsp-legacy") {
  return {
    version: 1,
    testId: "legacy",
    workspaceId: resourceScopeId,
    title: "Legacy assessment",
    kind: "knowledge",
    status: "active",
    dimensions: [],
    results: [],
    questions: [
      {
        questionId: "q1",
        prompt: "First?",
        options: [
          { optionId: "yes", label: "Yes", points: 1 },
          { optionId: "no", label: "No", points: 0 },
        ],
      },
      {
        questionId: "q2",
        prompt: "Second?",
        options: [
          { optionId: "one", label: "One", points: 1 },
          { optionId: "two", label: "Two", points: 0 },
        ],
      },
    ],
    createdByGlobalId: "usr_owner",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function legacyAttempt(resourceScopeId = "wsp-legacy") {
  return {
    version: 1,
    attemptId: "att_11111111111111111111111111111111",
    testId: "legacy",
    workspaceId: resourceScopeId,
    globalId: "usr_participant",
    status: "active",
    answers: [{ questionId: "q1", optionId: "yes", answeredAt: timestamp }],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function writeLegacyDatabase(root: string, resourceScopeId = "wsp-legacy") {
  const database = new DatabaseSync(path.join(root, "sg", "wsp6.sqlite"));
  database.exec(`
    CREATE TABLE sg_wsp6_state (
      namespace TEXT NOT NULL,
      key TEXT NOT NULL,
      value_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (namespace, key)
    ) STRICT;
  `);
  const insert = database.prepare(
    "INSERT INTO sg_wsp6_state (namespace, key, value_json, created_at) VALUES (?, ?, ?, ?)",
  );
  insert.run("definitions", "test:legacy", JSON.stringify(legacyDefinition(resourceScopeId)), 1);
  insert.run("attempts", "active:legacy", JSON.stringify(legacyAttempt(resourceScopeId)), 2);
  database.close();
}

function databaseSnapshot(root: string) {
  const database = new DatabaseSync(path.join(root, "sg", "wsp6.sqlite"));
  const rows = database
    .prepare(
      "SELECT namespace, key, value_json, created_at FROM sg_wsp6_state ORDER BY namespace, key",
    )
    .all();
  database.close();
  return rows;
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

describe("SG 2.2 Phase 9 WSP6 state migration", () => {
  it("preserves the Global ID and resumes a legacy resource attempt after restart", async () => {
    const root = await stateDir();
    await writeResourceScopes(root);
    writeLegacyDatabase(root);

    const result = runMigration(root);

    expect(result.status, result.stderr).toBe(0);
    const rows = databaseSnapshot(root);
    expect(JSON.stringify(rows)).not.toContain("workspaceId");
    expect(
      rows.some((row) => {
        const value = JSON.parse((row as { value_json: string }).value_json) as {
          globalId?: string;
        };
        return value.globalId === "usr_participant";
      }),
    ).toBe(true);
    expect(
      JSON.parse(await readFile(path.join(root, "sg", "archive", "wsp6-v1.json"), "utf8")),
    ).toMatchObject({ migrationVersion: 1, sourceRows: expect.any(Array) });

    const scope = { kind: "resource" as const, resourceScopeId: "wsp-legacy" };
    const restarted = new SgAssessmentRegistry(openSgAssessmentStores(root));
    await expect(
      restarted.resume("att_11111111111111111111111111111111", "usr_participant"),
    ).resolves.toMatchObject({ status: "active", question: { questionId: "q2" } });
    await expect(restarted.findDefinition("legacy", scope)).resolves.toMatchObject({ scope });

    const beforeSecondRun = JSON.stringify(databaseSnapshot(root));
    expect(runMigration(root).status).toBe(0);
    expect(JSON.stringify(databaseSnapshot(root))).toBe(beforeSecondRun);
  });

  it("fails closed when a legacy reference cannot map to a resource scope", async () => {
    const root = await stateDir();
    await writeResourceScopes(root);
    writeLegacyDatabase(root, "wsp-unmapped");
    const before = JSON.stringify(databaseSnapshot(root));

    const result = runMigration(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("sg-wsp6-migration-unmapped-scope");
    expect(JSON.stringify(databaseSnapshot(root))).toBe(before);
  });

  it("does not migrate WSP6 state while the SG plugin is disabled", async () => {
    const root = await stateDir();
    await writeResourceScopes(root);
    writeLegacyDatabase(root);
    const before = JSON.stringify(databaseSnapshot(root));

    expect(runMigration(root, "false").status).toBe(0);
    expect(JSON.stringify(databaseSnapshot(root))).toBe(before);
  });
});
