import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { readAutomationEvidence } from "./automation-diagnostics.js";

const started = Date.parse("2026-10-01T18:00:00Z");
const roots: string[] = [];

function fixture(options: { stale?: boolean } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), "sg-automation-diagnostic-"));
  roots.push(root);
  for (const directory of ["state", "sg", "agents/main/sessions"]) {
    mkdirSync(path.join(root, directory), { recursive: true });
  }
  const job = {
    id: "project-job",
    enabled: true,
    agentId: "main",
    payload: {
      kind: "agentTurn",
      message: "Check korzh260609-beep/garya-bot and /data/workspace/MEMORY.md",
    },
  };
  const db = new DatabaseSync(path.join(root, "state/openclaw.sqlite"));
  db.exec(`
    CREATE TABLE cron_jobs (
      store_key TEXT, job_id TEXT, job_json TEXT, state_json TEXT
    );
    CREATE TABLE task_runs (
      runtime TEXT, source_id TEXT, started_at INTEGER, ended_at INTEGER,
      child_session_key TEXT, detail_json TEXT
    );
  `);
  db.prepare("INSERT INTO cron_jobs VALUES (?, ?, ?, ?)").run(
    "cron-partition", job.id, JSON.stringify(job),
    JSON.stringify({ lastRunAtMs: started, lastDurationMs: 40000 }),
  );
  const taskStarted = options.stale ? started - 86400000 : started;
  db.prepare("INSERT INTO task_runs VALUES (?, ?, ?, ?, ?, ?)").run(
    "cron", job.id, taskStarted, taskStarted + 40000, "cron-session",
    JSON.stringify({
      kind: "cron-run", storeKey: "cron-partition", runAtMs: taskStarted,
      sessionId: "exact-session", durationMs: 40000,
    }),
  );
  db.close();
  const call = {
    type: "message", timestamp: new Date(started + 1000).toISOString(),
    message: {
      role: "assistant", content: [{
        type: "toolCall", id: "call-1", name: "exec",
        arguments: { host: "gateway", command: "gh api repos/korzh260609-beep/garya-bot" },
      }],
    },
  };
  const result = {
    type: "message", timestamp: new Date(started + 2000).toISOString(),
    message: {
      role: "toolResult", toolCallId: "call-1", toolName: "exec", isError: true,
      content: [{ type: "text", text: "SG could not verify the requester Global ID for device access" }],
    },
  };
  writeFileSync(
    path.join(root, "agents/main/sessions/exact-session.jsonl"),
    [call, result].map((row) => JSON.stringify(row)).join("\n") + "\n",
  );
  return root;
}

function digest(file: string) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("SG project automation diagnostic", () => {
  it("links current task_runs history to the exact transcript without modifying SQLite", async () => {
    const root = fixture();
    const dbPath = path.join(root, "state/openclaw.sqlite");
    const before = digest(dbPath);
    const evidence = await readAutomationEvidence({ stateDir: root, selector: "project", config: {} });
    expect(evidence.run?.sessionId).toBe("exact-session");
    expect(evidence.calls[0]?.errorCode).toBe("DEVICE_IDENTITY_ERROR_OBSERVED");
    expect(evidence.sources).toContainEqual(expect.objectContaining({
      name: "task_runs:cron-history", status: "OBSERVED",
    }));
    expect(digest(dbPath)).toBe(before);
  });

  it("does not attach an older task transcript to the latest cron run", async () => {
    const root = fixture({ stale: true });
    const evidence = await readAutomationEvidence({ stateDir: root, selector: "project", config: {} });
    expect(evidence.run?.runAtMs).toBe(started);
    expect(evidence.run?.sessionId).toBeUndefined();
    expect(evidence.calls).toEqual([]);
    expect(evidence.sources).toContainEqual(expect.objectContaining({
      name: "task_runs:cron-history", reason: "RUN_HISTORY_BEHIND_CURRENT_STATE",
    }));
  });
});
