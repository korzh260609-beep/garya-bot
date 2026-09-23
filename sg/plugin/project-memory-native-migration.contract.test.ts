import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(".");
const migrationScript = path.join(repoRoot, "scripts", "sg22-migrate-project-memory.mjs");
const historicalBootstrap = path.join(repoRoot, "sg", "workspace", "PROJECT_MEMORY_BOOTSTRAP.json");
const nativeProjectKey = "github.com/korzh260609-beep/garya-bot";

async function fixture() {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "sg-native-project-memory-"));
  const projectDir = path.join(workspace, "memory", "projects", "sg", "decisions");
  await mkdir(projectDir, { recursive: true });
  return { workspace, projectDir };
}

function runMigration(workspace: string, projectKey = nativeProjectKey) {
  return spawnSync(process.execPath, [migrationScript], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      OPENCLAW_WORKSPACE_DIR: workspace,
      SG22_NATIVE_PROJECT_KEY: projectKey,
    },
  });
}

function runBootstrapMigration(workspace: string, bootstrapPath: string) {
  return spawnSync(process.execPath, [migrationScript], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      OPENCLAW_WORKSPACE_DIR: workspace,
      SG22_NATIVE_PROJECT_KEY: nativeProjectKey,
      SG22_PROJECT_MEMORY_BOOTSTRAP_PATH: bootstrapPath,
    },
  });
}

describe("SG legacy project memory migration", () => {
  it("retags legacy records with the native deterministic project key", async () => {
    const { workspace, projectDir } = await fixture();
    const recordPath = path.join(projectDir, "decision.md");
    await writeFile(
      recordPath,
      [
        '<!-- sg-project-memory:{"schemaVersion":1} -->',
        "<!-- project: project-sg -->",
        "# Keep the native memory path",
        "",
      ].join("\n"),
      { mode: 0o600 },
    );

    const result = runMigration(workspace);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("scanned=1 migrated=1");
    expect(await readFile(recordPath, "utf8")).toContain(`<!-- project: ${nativeProjectKey} -->`);
  });

  it("is idempotent and preserves other project keys", async () => {
    const { workspace, projectDir } = await fixture();
    const recordPath = path.join(projectDir, "task.md");
    await writeFile(
      recordPath,
      "<!-- project: project-sg; github.com/acme/other; project-sg -->\n# Task\n",
      "utf8",
    );

    expect(runMigration(workspace).status).toBe(0);
    const migrated = await readFile(recordPath, "utf8");
    expect(migrated).toContain(`<!-- project: ${nativeProjectKey}; github.com/acme/other -->`);
    const second = runMigration(workspace);
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toContain("migrated=0");
    expect(await readFile(recordPath, "utf8")).toBe(migrated);
  });

  it("does not follow symlinks outside the legacy directory", async () => {
    const { workspace, projectDir } = await fixture();
    const outsidePath = path.join(workspace, "outside.md");
    const source = "<!-- project: project-sg -->\n# Outside\n";
    await writeFile(outsidePath, source, "utf8");
    await symlink(outsidePath, path.join(projectDir, "linked.md"));

    const result = runMigration(workspace);

    expect(result.status, result.stderr).toBe(0);
    expect(await readFile(outsidePath, "utf8")).toBe(source);
  });

  it("fails closed for an invalid project key", async () => {
    const { workspace } = await fixture();
    const result = runMigration(workspace, "bad;key");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("sg-project-memory-migration-project-key-invalid");
  });

  it("appends a historical bootstrap to native MEMORY.md exactly once", async () => {
    const { workspace } = await fixture();
    const memoryPath = path.join(workspace, "MEMORY.md");
    const bootstrapPath = path.join(workspace, "PROJECT_MEMORY_BOOTSTRAP.json");
    await writeFile(memoryPath, "Existing native memory.\n", { mode: 0o600 });
    await writeFile(
      bootstrapPath,
      JSON.stringify({
        schemaVersion: 1,
        projectKey: nativeProjectKey,
        records: [
          {
            id: "sg22-bootstrap-test",
            recordedAt: "2026-09-21",
            title: "Verified project history",
            summary: "The historical bootstrap reached native project memory.",
            evidence: ["github:commit:abc", "render:deploy:dep-test:live"],
          },
        ],
      }),
      "utf8",
    );

    const first = runBootstrapMigration(workspace, bootstrapPath);
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain("bootstrap_scanned=1 bootstrap_added=1");
    const migrated = await readFile(memoryPath, "utf8");
    expect(migrated).toContain("Existing native memory.");
    expect(migrated).toContain("<!-- sg-project-bootstrap: sg22-bootstrap-test -->");
    expect(migrated).toContain(`<!-- project: ${nativeProjectKey} -->`);
    expect(migrated).toContain("Verified project history");

    const second = runBootstrapMigration(workspace, bootstrapPath);
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toContain("bootstrap_scanned=1 bootstrap_added=0");
    expect(await readFile(memoryPath, "utf8")).toBe(migrated);
  });

  it("loads every record from the bundled historical bootstrap", async () => {
    const { workspace } = await fixture();
    const memoryPath = path.join(workspace, "MEMORY.md");

    const first = runBootstrapMigration(workspace, historicalBootstrap);
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain("bootstrap_scanned=16 bootstrap_added=16");
    const migrated = await readFile(memoryPath, "utf8");
    expect(migrated.match(/<!-- sg-project-bootstrap:/gu)).toHaveLength(16);
    expect(migrated.match(new RegExp(`<!-- project: ${nativeProjectKey} -->`, "gu"))).toHaveLength(
      16,
    );
    expect(migrated).toContain("Ежедневный аудит проектной памяти ещё не создан");
    expect(migrated).toContain("Ежедневный аудит и запись в Project Memory работают");

    const second = runBootstrapMigration(workspace, historicalBootstrap);
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toContain("bootstrap_scanned=16 bootstrap_added=0");
    expect(await readFile(memoryPath, "utf8")).toBe(migrated);
  });
});
