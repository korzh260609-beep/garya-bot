import { execFile, spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const hookScript = path.join(process.cwd(), ".codex/hooks/project-memory-guard.mjs");
const handoffPath = "pillars/project-memory/SG22_PROJECT_MEMORY_HANDOFFS.json";

async function git(cwd: string, ...args: string[]) {
  return execFileAsync("git", args, { cwd });
}

async function runHook(cwd: string, mode: "snapshot" | "stop", turnId: string) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn("node", [hookScript, mode], { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`hook exited ${String(code)}: ${stderr}`));
      }
    });
    child.stdin.end(JSON.stringify({ turn_id: turnId, cwd, stop_hook_active: false }));
  });
}

describe("Codex automatic Project Memory bridge", () => {
  it("blocks a changed project turn until the canonical semantic handoff changes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "sg-codex-pm-hook-"));
    await git(root, "init");
    await git(root, "config", "user.email", "test@example.com");
    await git(root, "config", "user.name", "SG Test");
    await mkdir(path.join(root, path.dirname(handoffPath)), { recursive: true });
    await writeFile(path.join(root, "feature.txt"), "before\n");
    await writeFile(
      path.join(root, handoffPath),
      JSON.stringify({
        schemaVersion: 1,
        repository: {
          fullName: "korzh260609-beep/garya-bot",
          branch: "dev/sg2.2-openclaw",
        },
        handoffs: [],
      }),
    );
    await git(root, "add", ".");
    await git(root, "commit", "-m", "baseline");

    await runHook(root, "snapshot", "turn-automatic-memory");
    await writeFile(path.join(root, "feature.txt"), "after\n");

    const blocked = await runHook(root, "stop", "turn-automatic-memory");
    expect(JSON.parse(blocked.stdout)).toEqual(
      expect.objectContaining({
        decision: "block",
        reason: expect.stringContaining("SG22_PROJECT_MEMORY_HANDOFFS.json"),
      }),
    );

    const manifest = JSON.parse(await readFile(path.join(root, handoffPath), "utf8")) as Record<
      string,
      unknown
    >;
    await writeFile(
      path.join(root, handoffPath),
      JSON.stringify({
        ...manifest,
        handoffs: [
          {
            schemaVersion: 1,
            handoffId: "turn-automatic-memory",
            projectKey: "project-sg",
            authority: { kind: "canonical-project-artifact" },
            events: [
              {
                eventId: "turn-automatic-memory:task",
                eventType: "task.completed",
                recordType: "task",
                title: "Automatic memory bridge completed",
                summary: "The approved project change was completed.",
                status: "done",
                sourceRefs: ["github:commit:1234567890abcdef1234567890abcdef12345678"],
              },
            ],
          },
        ],
      }),
    );

    const accepted = await runHook(root, "stop", "turn-automatic-memory");
    expect(accepted.stdout).toBe("");
  });
});
