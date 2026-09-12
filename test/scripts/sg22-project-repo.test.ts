import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(".");
const scriptPath = path.join(repoRoot, "scripts", "sg22-project-repo.sh");
const branch = "dev/sg2.2-openclaw";
const origin = "https://github.com/korzh260609-beep/garya-bot.git";

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  expect(result.status, `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`).toBe(0);
  return result.stdout.trim();
}

async function createHarness() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg22-project-repo-"));
  const home = path.join(root, "home");
  const workspace = path.join(root, "workspace");
  const source = path.join(root, "source");
  const upstream = path.join(root, "upstream.git");
  const bin = path.join(root, "bin");
  const env = {
    HOME: home,
    OPENCLAW_WORKSPACE_DIR: workspace,
    PATH: `${bin}:${process.env.PATH ?? ""}`,
  };

  await Promise.all([mkdir(home), mkdir(workspace), mkdir(source), mkdir(bin)]);
  run("git", ["init", "-b", branch], source, env);
  run("git", ["config", "user.name", "SG Test"], source, env);
  run("git", ["config", "user.email", "sg-test@example.invalid"], source, env);
  await writeFile(path.join(source, "README.md"), "one\n", "utf8");
  run("git", ["add", "README.md"], source, env);
  run("git", ["commit", "-m", "initial"], source, env);
  run("git", ["clone", "--bare", source, upstream], root, env);
  run("git", ["config", "--global", `url.file://${upstream}.insteadOf`, origin], root, env);

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
  "repo clone")
    repository="\${3:?}"
    destination="\${4:?}"
    [ "$repository" = "korzh260609-beep/garya-bot" ] && repository="https://github.com/korzh260609-beep/garya-bot.git"
    shift 4
    [ "\${1:-}" = "--" ] && shift
    git clone "$repository" "$destination" "$@"
    git -C "$destination" remote set-url origin "https://github.com/korzh260609-beep/garya-bot.git"
    ;;
  *) exit 2 ;;
esac
`,
    "utf8",
  );
  await chmod(path.join(bin, "gh"), 0o755);

  const checkout = path.join(workspace, "project-sg", "garya-bot");
  const execute = () =>
    spawnSync("sh", [scriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, ...env },
    });

  return { root, source, upstream, workspace, checkout, env, execute };
}

describe("SG 2.2 Project SG repository workspace", () => {
  it("creates an authenticated persistent checkout on the only permitted branch", async () => {
    const harness = await createHarness();
    const result = harness.execute();

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(
      run("git", ["config", "--get", "remote.origin.url"], harness.checkout, harness.env),
    ).toBe(origin);
    expect(run("git", ["branch", "--show-current"], harness.checkout, harness.env)).toBe(branch);
    expect(run("git", ["status", "--porcelain"], harness.checkout, harness.env)).toBe("");
    expect(run("git", ["config", "user.name"], harness.checkout, harness.env)).toBe(
      "korzh260609-beep",
    );
    expect(run("git", ["config", "user.email"], harness.checkout, harness.env)).toBe(
      "229480991+korzh260609-beep@users.noreply.github.com",
    );
    expect(result.stdout).toContain("status=ready");
  });

  it("refuses a wrong origin, wrong branch, dirty tree, or unpublished local commit", async () => {
    const harness = await createHarness();
    expect(harness.execute().status).toBe(0);

    run(
      "git",
      ["remote", "set-url", "origin", "https://github.com/example/wrong.git"],
      harness.checkout,
      harness.env,
    );
    let result = harness.execute();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("unexpected origin");

    run("git", ["remote", "set-url", "origin", origin], harness.checkout, harness.env);
    run("git", ["switch", "-c", "main"], harness.checkout, harness.env);
    result = harness.execute();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("unexpected branch");

    run("git", ["switch", branch], harness.checkout, harness.env);
    await writeFile(path.join(harness.checkout, "README.md"), "dirty\n", "utf8");
    result = harness.execute();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("working tree is not clean");

    run("git", ["restore", "README.md"], harness.checkout, harness.env);
    await writeFile(path.join(harness.checkout, "local.txt"), "local\n", "utf8");
    run("git", ["add", "local.txt"], harness.checkout, harness.env);
    run("git", ["commit", "-m", "local"], harness.checkout, harness.env);
    result = harness.execute();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("local HEAD does not match remote");
  });

  it("fast-forwards a clean checkout when the approved remote branch advances", async () => {
    const harness = await createHarness();
    expect(harness.execute().status).toBe(0);
    const before = run("git", ["rev-parse", "HEAD"], harness.checkout, harness.env);

    await writeFile(path.join(harness.source, "README.md"), "two\n", "utf8");
    run("git", ["add", "README.md"], harness.source, harness.env);
    run("git", ["commit", "-m", "remote update"], harness.source, harness.env);
    run(
      "git",
      ["push", `file://${harness.upstream}`, `${branch}:${branch}`],
      harness.source,
      harness.env,
    );

    const result = harness.execute();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const after = run("git", ["rev-parse", "HEAD"], harness.checkout, harness.env);
    expect(after).not.toBe(before);
    expect(after).toBe(
      run("git", ["rev-parse", `origin/${branch}`], harness.checkout, harness.env),
    );
  });

  it("is wired into the live workspace contract without creating a parallel repository layer", async () => {
    const [agents, script, overlay] = await Promise.all([
      readFile(path.join(repoRoot, "sg", "workspace", "AGENTS.md"), "utf8"),
      readFile(scriptPath, "utf8"),
      readFile(path.join(repoRoot, "Dockerfile.sg22-overlay"), "utf8"),
    ]);

    expect(agents).toContain("sh /app/scripts/sg22-project-repo.sh");
    expect(agents).toContain("/data/workspace/project-sg/garya-bot");
    expect(agents).toContain(
      "Never reset, clean, stash, overwrite, or switch branches automatically.",
    );
    expect(script).toContain('repo="korzh260609-beep/garya-bot"');
    expect(script).toContain('branch="dev/sg2.2-openclaw"');
    expect(script).not.toContain("git reset");
    expect(script).not.toContain("git clean");
    expect(script).not.toContain("git stash");
    expect(overlay).toContain(
      "COPY --chown=node:node scripts/sg22-project-repo.sh /app/scripts/sg22-project-repo.sh",
    );
  });
});
