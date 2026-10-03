import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeAutomationEvidence, formatSgAutomationDiagnostic, observeTranscript, readAutomationEvidence } from "./automation-diagnostics.js";

const started = Date.parse("2026-10-01T18:00:00Z");
const roots: string[] = [];

function fixture(options: { stale?: boolean; runAgentId?: string } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), "sg-automation-diagnostic-"));
  roots.push(root);
  const runAgentId = options.runAgentId ?? "main";
  for (const directory of ["state", "sg", `agents/${runAgentId}/agent`]) {
    mkdirSync(path.join(root, directory), { recursive: true });
  }
  const job = {
    id: "project-job",
    enabled: true,
    agentId: "main",
    owner: { sessionKey: "owner-session", accountId: "account-one" },
    scheduledToolPolicy: { version: 1, mode: "account", ownerSessionKey: "owner-session", ownerAccountId: "account-one" },
    payload: {
      kind: "agentTurn",
      message: "Check korzh260609-beep/garya-bot and /data/workspace/MEMORY.md",
      toolsAllow: ["read", "exec"],
    },
  };
  const db = new DatabaseSync(path.join(root, "state/openclaw.sqlite"));
  db.exec(`
    CREATE TABLE cron_jobs (
      store_key TEXT, job_id TEXT, job_json TEXT, state_json TEXT
    );
    CREATE TABLE task_runs (
      runtime TEXT, source_id TEXT, started_at INTEGER, ended_at INTEGER,
      child_session_key TEXT, agent_id TEXT, detail_json TEXT
    );
  `);
  db.prepare("INSERT INTO cron_jobs VALUES (?, ?, ?, ?)").run(
    "cron-partition", job.id, JSON.stringify(job),
    JSON.stringify({ lastRunAtMs: started, lastDurationMs: 40000 }),
  );
  const taskStarted = options.stale ? started - 86400000 : started;
  db.prepare("INSERT INTO task_runs VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "cron", job.id, taskStarted, taskStarted + 40000, "cron-session", runAgentId,
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
        type: "toolCall", id: "call_example|fc_example", name: "exec",
        arguments: { host: "gateway", command: "gh api repos/korzh260609-beep/garya-bot --token DUMMY_SECRET" },
      }],
    },
  };
  const result = {
    type: "message", timestamp: new Date(started + 2000).toISOString(),
    message: {
      role: "toolResult", toolCallId: "call_example|fc_example", toolName: "exec", isError: true,
      content: [{ type: "text", text: "SG could not verify the requester Global ID for device access" }],
    },
  };
  const agent = new DatabaseSync(path.join(root, `agents/${runAgentId}/agent/openclaw-agent.sqlite`));
  agent.exec("CREATE TABLE session_windows (session_id TEXT PRIMARY KEY, session_key TEXT); CREATE TABLE transcript_events (session_id TEXT, seq INTEGER, event_json TEXT, created_at INTEGER, PRIMARY KEY(session_id, seq)); CREATE TABLE session_transcript_archives (session_id TEXT, generation TEXT)");
  agent.prepare("INSERT INTO session_windows VALUES (?, ?)").run("exact-session", "cron-session");
  for (const [index, event] of [call, result].entries()) {
    agent.prepare("INSERT INTO transcript_events VALUES (?, ?, ?, ?)").run("exact-session", index + 1, JSON.stringify(event), started + index * 1000);
  }
  // A second session must never be attributed to this run.
  agent.prepare("INSERT INTO transcript_events VALUES (?, ?, ?, ?)").run("other-session", 1, JSON.stringify(call), started);
  agent.close();
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
    const agentPath = path.join(root, "agents/main/agent/openclaw-agent.sqlite");
    const before = digest(dbPath);
    const agentBefore = digest(agentPath);
    const evidence = await readAutomationEvidence({ stateDir: root, selector: "project", config: {} });
    expect(evidence.run?.sessionId).toBe("exact-session");
    expect(evidence.calls[0]?.errorCode).toBe("DEVICE_IDENTITY_ERROR_OBSERVED");
    expect(evidence.calls).toHaveLength(1);
    expect(evidence.transcript).toMatchObject({
      agentSource: "run", sessionWindow: "PRESENT", sessionKeyMatch: "EQUAL", archivedGenerations: 0,
      totalEvents: 2, parsedEvents: 2, eventsInRunWindow: 2,
      assistantToolCallsInWindow: 1, toolResultsInWindow: 1, partial: false,
    });
    const report = analyzeAutomationEvidence(evidence);
    expect(report.facts.scheduledPolicyMode).toBe("account");
    const output = formatSgAutomationDiagnostic(report);
    expect(output).toContain("Вызовы выбранного запуска (1/1; returned ≠ успех)");
    expect(output).toContain("tool=exec; inner=UNKNOWN; status=error; code=DEVICE_IDENTITY_ERROR_OBSERVED; target=github; host=gateway");
    expect(output).not.toContain("DUMMY_SECRET");
    expect(output).not.toContain("call_example|fc_example");
    expect(output).not.toContain("gh api");
    expect(report.checks).toContainEqual(expect.objectContaining({ stage: "owner-policy-binding", status: "OBSERVED" }));
    expect(evidence.sources).toContainEqual(expect.objectContaining({
      name: "task_runs:cron-history", status: "OBSERVED",
    }));
    expect(digest(dbPath)).toBe(before);
    expect(digest(agentPath)).toBe(agentBefore);
  });

  it("shows returned as unverified rather than successful", () => {
    const calls = [{ callId: "call-1", tool: "read", target: "project-memory" as const, result: "returned" as const }];
    const report = analyzeAutomationEvidence({
      job: { id: "project-job" }, run: { jobId: "project-job", runAtMs: started }, calls, sources: [],
    });
    const output = formatSgAutomationDiagnostic(report);
    expect(output).toContain("Вызовы выбранного запуска (1/1; returned ≠ успех)");
    expect(output).toContain("tool=read; inner=UNKNOWN; status=returned; code=UNKNOWN; target=project-memory; host=UNKNOWN; evidence=UNKNOWN");
  });

  it("identifies structured blocks and tool_call targets without exposing input or result text", () => {
    const toolCall = (id: string, name: string, args: Record<string, unknown>, offset: number) => ({
      timestamp: started + offset, message: { role: "assistant", content: [{ type: "toolCall", id, name, arguments: args }] },
    });
    const toolResult = (id: string, name: string, extra: Record<string, unknown>, offset: number) => ({
      timestamp: started + offset, message: { role: "toolResult", toolCallId: id, toolName: name, isError: false, ...extra },
    });
    const deviceError = "SG could not verify the requester Global ID for device access";
    const rows = [
      toolCall("exec-id", "exec", { host: "sandbox", command: "PRIVATE_COMMAND" }, 1000),
      toolResult("exec-id", "exec", { details: { status: "blocked" }, content: [{ type: "text", text: deviceError }] }, 2000),
      toolCall("github-id", "tool_call", { id: "github-id", args: { token: "PRIVATE_TOKEN" } }, 3000),
      toolResult("github-id", "tool_call", { content: [{ type: "text", text: JSON.stringify({
        tool: { name: "github_publish" }, result: { details: { status: "failed", error: "PRIVATE_ERROR" } }, status: "failed",
      }) }] }, 4000),
      toolCall("memory-id", "tool_call", { id: "read", args: { path: "/data/workspace/MEMORY.md" } }, 5000),
      toolResult("memory-id", "tool_call", { details: {
        tool: { name: "read" }, result: { details: { status: "blocked" }, content: [{ type: "text", text: deviceError }] }, status: "blocked",
      } }, 6000),
      toolCall("unknown-id", "read", { path: "/data/workspace/MEMORY.md" }, 7000),
      toolResult("unknown-id", "read", { content: [{ type: "text", text: "PRIVATE_CONTENT" }] }, 8000),
    ];
    const run = { jobId: "project-job", runAtMs: started, ts: started + 10000 };
    const calls = observeTranscript(rows, run);
    expect(calls.map(call => call.result)).toEqual(["blocked", "error", "blocked", "returned"]);
    expect(calls[0]).toMatchObject({ errorCode: "DEVICE_IDENTITY_ERROR_OBSERVED", requestedHost: "sandbox" });
    expect(calls[1]).toMatchObject({ innerTool: "github_publish", target: "github", errorCode: "STATUS_FAILED" });
    expect(calls[2]).toMatchObject({ innerTool: "read", target: "project-memory", resultEvidence: "structured" });
    expect(calls[3]).toMatchObject({ resultEvidence: "unavailable" });
    const report = analyzeAutomationEvidence({ job: { id: "project-job" }, run, calls, sources: [] });
    expect(report.first_unknown_stage).toBe("global-id");
    const output = formatSgAutomationDiagnostic(report);
    expect(output).toContain("tool=tool_call; inner=github_publish; status=error");
    expect(output).not.toMatch(/PRIVATE_COMMAND|PRIVATE_TOKEN|PRIVATE_ERROR|PRIVATE_CONTENT/);
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

  it("uses the run's agent database if the current job agent differs", async () => {
    const root = fixture({ runAgentId: "audit" });
    const evidence = await readAutomationEvidence({ stateDir: root, selector: "project", config: {} });
    expect(evidence.calls[0]?.errorCode).toBe("DEVICE_IDENTITY_ERROR_OBSERVED");
    expect(evidence.transcript).toMatchObject({ agentSource: "run", runAgentMatchesCurrent: false });
  });

  it("distinguishes an existing empty transcript from a tool-free run", async () => {
    const root = fixture();
    const agent = new DatabaseSync(path.join(root, "agents/main/agent/openclaw-agent.sqlite"));
    agent.prepare("DELETE FROM transcript_events WHERE session_id=?").run("exact-session");
    agent.close();
    const evidence = await readAutomationEvidence({ stateDir: root, selector: "project", config: {} });
    expect(evidence.calls).toEqual([]);
    expect(evidence.transcript).toMatchObject({ sessionWindow: "PRESENT", totalEvents: 0, parsedEvents: 0 });
  });
});
