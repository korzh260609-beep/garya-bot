import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(".");
const scriptPath = path.join(repoRoot, "scripts", "sg22-project-repo.sh");
const defaultRepo = "korzh260609-beep/garya-bot";
const defaultBranch = "dev/sg2.2-openclaw";
const otherRepo = "example/garya-bot";
const otherBranch = "feature/other";

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  expect(result.status, `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`).toBe(0);
  return result.stdout.trim();
}

function field(output: string, name: string) {
  const line = output.split("\n").find((candidate) => candidate.startsWith(`${name}=`));
  expect(line, `missing ${name} in:\n${output}`).toBeDefined();
  return line?.slice(name.length + 1) ?? "";
}

async function createSource(root: string, name: string, branch: string) {
  const source = path.join(root, `${name}-source`);
  const upstream = path.join(root, `${name}-upstream.git`);
  await mkdir(source);
  run("git", ["init", "-b", branch], source);
  run("git", ["config", "user.name", "SG Test"], source);
  run("git", ["config", "user.email", "sg-test@example.invalid"], source);
  await writeFile(path.join(source, "README.md"), `${name}\n`, "utf8");
  run("git", ["add", "README.md"], source);
  run("git", ["commit", "-m", "initial"], source);
  if (branch !== "main") {
    run("git", ["branch", "main"], source);
  }
  run("git", ["clone", "--bare", source, upstream], root);
  return { source, upstream };
}

async function createHarness() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg22-project-repo-"));
  const home = path.join(root, "home");
  const workspace = path.join(root, "workspace");
  const bin = path.join(root, "bin");
  await Promise.all([mkdir(home), mkdir(workspace), mkdir(bin)]);

  const primary = await createSource(root, "primary", defaultBranch);
  const secondary = await createSource(root, "secondary", otherBranch);
  await writeFile(
    path.join(bin, "gh"),
    `#!/bin/sh
set -eu
case "\${1:-} \${2:-}" in
  "auth status"|"auth setup-git") exit 0 ;;
  "api user")
    case "$*" in
      *".login"*) printf '%s\\n' 'korzh260609-beep' ;;
      *".id"*) printf '%s\\n' '229480991' ;;
      *) exit 2 ;;
    esac
    ;;
  "repo view")
    case "\${3:-}" in
      "${defaultRepo}"|"https://github.com/${defaultRepo}.git"|"git@github.com:${defaultRepo}.git") printf '%s\\n' '${defaultRepo}' ;;
      "${otherRepo}"|"https://github.com/${otherRepo}.git"|"git@github.com:${otherRepo}.git") printf '%s\\n' '${otherRepo}' ;;
      *) exit 1 ;;
    esac
    ;;
  "repo clone")
    repository="\${3:?}"
    destination="\${4:?}"
    case "$repository" in
      "${defaultRepo}") source="$SG_TEST_PRIMARY_UPSTREAM" ; canonical="${defaultRepo}" ;;
      "${otherRepo}") source="$SG_TEST_SECONDARY_UPSTREAM" ; canonical="${otherRepo}" ;;
      *) exit 1 ;;
    esac
    shift 4
    [ "\${1:-}" = "--" ] && shift
    git clone "$source" "$destination" "$@"
    git --git-dir "$destination" remote set-url origin "https://github.com/$canonical.git"
    ;;
  *) exit 2 ;;
esac
`,
    "utf8",
  );
  await chmod(path.join(bin, "gh"), 0o755);

  const env = {
    HOME: home,
    OPENCLAW_WORKSPACE_DIR: workspace,
    PATH: `${bin}:${process.env.PATH ?? ""}`,
    SG_TEST_PRIMARY_UPSTREAM: primary.upstream,
    SG_TEST_SECONDARY_UPSTREAM: secondary.upstream,
  };
  run(
    "git",
    [
      "config",
      "--global",
      `url.file://${primary.upstream}.insteadOf`,
      `https://github.com/${defaultRepo}.git`,
    ],
    root,
    env,
  );
  run(
    "git",
    [
      "config",
      "--global",
      `url.file://${secondary.upstream}.insteadOf`,
      `https://github.com/${otherRepo}.git`,
    ],
    root,
    env,
  );
  const execute = (args: string[] = []) =>
    spawnSync("sh", [scriptPath, ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, ...env },
    });

  return { root, workspace, env, execute, primary, secondary };
}

describe("SG GitHub repository workspace", () => {
  it("keeps SG 2.2 as a default without restricting other repositories or branches", async () => {
    const harness = await createHarness();
    const defaultResult = harness.execute();
    expect(defaultResult.status, `${defaultResult.stdout}\n${defaultResult.stderr}`).toBe(0);
    expect(field(defaultResult.stdout, "repository")).toBe(defaultRepo);
    expect(field(defaultResult.stdout, "branch")).toBe(defaultBranch);
    expect(Number(field(defaultResult.stdout, "disk_available_kb_before"))).toBeGreaterThan(0);
    expect(Number(field(defaultResult.stdout, "disk_available_kb_after"))).toBeGreaterThan(0);

    const mainResult = harness.execute(["prepare", defaultRepo, "main"]);
    expect(mainResult.status, `${mainResult.stdout}\n${mainResult.stderr}`).toBe(0);
    expect(field(mainResult.stdout, "branch")).toBe("main");
    expect(field(mainResult.stdout, "path")).not.toBe(field(defaultResult.stdout, "path"));

    const otherResult = harness.execute(["prepare", otherRepo, otherBranch]);
    expect(otherResult.status, `${otherResult.stdout}\n${otherResult.stderr}`).toBe(0);
    expect(field(otherResult.stdout, "repository")).toBe(otherRepo);
    expect(field(otherResult.stdout, "branch")).toBe(otherBranch);
    expect(field(otherResult.stdout, "path")).not.toBe(field(defaultResult.stdout, "path"));
  });

  it("rejects malformed repository and branch inputs without creating unsafe paths", async () => {
    const harness = await createHarness();
    let result = harness.execute(["prepare", "../outside", "main"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("invalid GitHub repository");

    result = harness.execute(["prepare", defaultRepo, "../../outside"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("invalid branch name");
  });

  it("reports dirty and ahead states without blocking an authorized commit or push flow", async () => {
    const harness = await createHarness();
    const prepared = harness.execute();
    expect(prepared.status, `${prepared.stdout}\n${prepared.stderr}`).toBe(0);
    const checkout = field(prepared.stdout, "path");

    await writeFile(path.join(checkout, "README.md"), "dirty\n", "utf8");
    let status = harness.execute(["status", defaultRepo, defaultBranch]);
    expect(status.status, `${status.stdout}\n${status.stderr}`).toBe(0);
    expect(field(status.stdout, "working_tree")).toBe("dirty");
    expect(field(status.stdout, "relation")).toBe("equal");

    run("git", ["add", "README.md"], checkout, harness.env);
    run("git", ["commit", "-m", "local"], checkout, harness.env);
    status = harness.execute(["status", defaultRepo, defaultBranch]);
    expect(status.status, `${status.stdout}\n${status.stderr}`).toBe(0);
    expect(field(status.stdout, "working_tree")).toBe("clean");
    expect(field(status.stdout, "relation")).toBe("ahead");
  });

  it("accepts equivalent GitHub origins but rejects a different repository", async () => {
    const harness = await createHarness();
    const prepared = harness.execute();
    expect(prepared.status).toBe(0);
    const checkout = field(prepared.stdout, "path");

    run(
      "git",
      ["remote", "set-url", "origin", `git@github.com:${defaultRepo}.git`],
      checkout,
      harness.env,
    );
    let status = harness.execute(["status", defaultRepo, defaultBranch]);
    expect(status.status, `${status.stdout}\n${status.stderr}`).toBe(0);

    run(
      "git",
      ["remote", "set-url", "origin", "https://github.com/example/wrong.git"],
      checkout,
      harness.env,
    );
    status = harness.execute(["status", defaultRepo, defaultBranch]);
    expect(status.status).not.toBe(0);
    expect(status.stderr).toContain("unexpected origin");
  });

  it("syncs only a clean behind branch and preserves dirty work", async () => {
    const harness = await createHarness();
    const prepared = harness.execute();
    expect(prepared.status).toBe(0);
    const checkout = field(prepared.stdout, "path");
    const before = run("git", ["rev-parse", "HEAD"], checkout, harness.env);

    await writeFile(path.join(harness.primary.source, "README.md"), "remote\n", "utf8");
    run("git", ["add", "README.md"], harness.primary.source, harness.env);
    run("git", ["commit", "-m", "remote update"], harness.primary.source, harness.env);
    run(
      "git",
      ["push", harness.primary.upstream, `${defaultBranch}:${defaultBranch}`],
      harness.primary.source,
      harness.env,
    );

    const synced = harness.execute(["sync", defaultRepo, defaultBranch]);
    expect(synced.status, `${synced.stdout}\n${synced.stderr}`).toBe(0);
    expect(field(synced.stdout, "relation")).toBe("equal");
    expect(run("git", ["rev-parse", "HEAD"], checkout, harness.env)).not.toBe(before);

    await writeFile(path.join(checkout, "README.md"), "preserve\n", "utf8");
    const refused = harness.execute(["sync", defaultRepo, defaultBranch]);
    expect(refused.status).not.toBe(0);
    expect(refused.stderr).toContain("working tree is not clean");
  });

  it("reports divergence and refuses to rewrite either history", async () => {
    const harness = await createHarness();
    const prepared = harness.execute();
    expect(prepared.status).toBe(0);
    const checkout = field(prepared.stdout, "path");

    await writeFile(path.join(checkout, "local.txt"), "local\n", "utf8");
    run("git", ["add", "local.txt"], checkout, harness.env);
    run("git", ["commit", "-m", "local"], checkout, harness.env);

    await writeFile(path.join(harness.primary.source, "remote.txt"), "remote\n", "utf8");
    run("git", ["add", "remote.txt"], harness.primary.source, harness.env);
    run("git", ["commit", "-m", "remote"], harness.primary.source, harness.env);
    run(
      "git",
      ["push", harness.primary.upstream, `${defaultBranch}:${defaultBranch}`],
      harness.primary.source,
      harness.env,
    );

    const status = harness.execute(["status", defaultRepo, defaultBranch]);
    expect(status.status, `${status.stdout}\n${status.stderr}`).toBe(0);
    expect(field(status.stdout, "relation")).toBe("diverged");

    const refused = harness.execute(["sync", defaultRepo, defaultBranch]);
    expect(refused.status).not.toBe(0);
    expect(refused.stderr).toContain("preserving both histories");
  });

  it("uses native Git and GitHub without destructive recovery or a repository allowlist", async () => {
    const [agents, script, overlay] = await Promise.all([
      readFile(path.join(repoRoot, "sg", "workspace", "AGENTS.md"), "utf8"),
      readFile(scriptPath, "utf8"),
      readFile(path.join(repoRoot, "Dockerfile.sg22-overlay"), "utf8"),
    ]);

    expect(agents).toContain("any repository accessible to the authenticated GitHub account");
    expect(agents).toContain("any existing branch");
    expect(agents).toContain("defaults, not an allowlist");
    expect(agents).toContain(
      "do not introduce repository or branch allowlists without separate owner approval",
    );
    expect(script).not.toContain("--single-branch");
    expect(script).not.toContain("git reset");
    expect(script).not.toContain("git clean");
    expect(script).not.toContain("git stash");
    expect(overlay).toContain(
      "COPY --chown=node:node scripts/sg22-project-repo.sh /app/scripts/sg22-project-repo.sh",
    );
  });
});
