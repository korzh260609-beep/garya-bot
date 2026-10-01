/** On-demand SG diagnostic. No policy changes, network calls, profile creation or cron execution. */
import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const BASE_REF = "8de67d593faf66aba53f74105a12347b73cb4c41";
const PROJECT_MEMORY = "/data/workspace/MEMORY.md";
const PROJECT_REPOSITORY = "korzh260609-beep/garya-bot";
const MAX_BYTES = 512 * 1024;
const MAX_ROWS = 128;
const IDENTIFIER = /^[a-zA-Z0-9_-]{1,160}$/u;
type RecordValue = Record<string, unknown>;
type Status = "OBSERVED" | "MISMATCH" | "BLOCKED" | "UNKNOWN";
export type Check = { stage: string; status: Status; scope: "current" | "run"; code: string };
type Source = { name: string; status: "OBSERVED" | "UNKNOWN"; reason?: string; truncated?: boolean };
export type ToolObservation = {
  callId: string; tool: string; requestedHost?: string; target?: "github" | "project-memory";
  errorCode?: string; errorAtMs?: number; result: "error" | "returned" | "unknown";
};
type TranscriptFacts = {
  agentSource: "run" | "current-job";
  runAgentMatchesCurrent: boolean | "UNKNOWN";
  sessionWindow: "PRESENT" | "ABSENT" | "UNAVAILABLE";
  sessionKeyMatch: "EQUAL" | "DIFFERS" | "UNKNOWN";
  archivedGenerations: number | "UNKNOWN";
  totalEvents: number;
  selectedEvents: number;
  parsedEvents: number;
  eventsInRunWindow: number;
  assistantToolCallsInWindow: number;
  toolResultsInWindow: number;
  firstSelectedAtMs?: number;
  lastSelectedAtMs?: number;
  partial: boolean;
};
export type AutomationEvidence = {
  job?: RecordValue;
  run?: RecordValue;
  authority?: RecordValue;
  billingJobOwner?: RecordValue;
  billingSessionOwner?: RecordValue;
  billingCandidateCount?: number;
  declarations?: RecordValue;
  transcript?: TranscriptFacts;
  calls: ToolObservation[];
  sources: Source[];
};
export type AutomationReport = {
  version: 1; baseRef: string; jobId?: string; runAtMs?: number;
  status: "MISMATCH" | "BLOCKED" | "UNKNOWN";
  first_confirmed_mismatch: Check | null;
  first_unknown_stage: string | null;
  first_observed_run_block: ToolObservation | null;
  root_cause: "UNKNOWN";
  checks: Check[];
  facts: RecordValue;
  sources: Source[];
};

function record(value: unknown): RecordValue | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue : undefined;
}
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
function parseObject(value: unknown): RecordValue | undefined {
  if (typeof value !== "string" || Buffer.byteLength(value) > MAX_BYTES) return undefined;
  try { return record(JSON.parse(value)); } catch { return undefined; }
}
function digest(value: unknown): string | undefined {
  const raw = text(value);
  return raw ? createHash("sha256").update(raw).digest("hex").slice(0, 12) : undefined;
}
function safeLabel(value: unknown): string | undefined {
  const raw = text(value);
  return raw && /^[\w.:/-]{1,160}$/u.test(raw) ? raw : undefined;
}
function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > 256 || value.some(x => typeof x !== "string" || !/^[\w.:*?/-]{1,160}$/u.test(x))) return undefined;
  return value as string[];
}
function publicPolicy(value: unknown): RecordValue | undefined {
  const obj = record(value);
  if (!obj) return undefined;
  return { allow: stringList(obj.allow), deny: stringList(obj.deny) };
}
function projectJob(job: RecordValue): boolean {
  const message = text(record(job.payload)?.message) ?? "";
  return message.includes(PROJECT_MEMORY) && message.includes(PROJECT_REPOSITORY);
}
function timestamp(value: unknown): number | undefined {
  if (number(value) !== undefined) return number(value);
  if (typeof value !== "string") return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}
function errorFingerprint(content: unknown): string | undefined {
  // Only structured error results reach this function; assistant prose is never evidence.
  const blocks = Array.isArray(content) ? content : [];
  const raw = blocks.flatMap(item => {
    const obj = record(item);
    return obj?.type === "text" && typeof obj.text === "string" ? [obj.text.slice(0, 8192)] : [];
  }).join("\n");
  const exact = raw.trim().replace(/^Error:\s*/u, "");
  if (exact === "SG could not verify the requester Global ID for device access") return "DEVICE_IDENTITY_ERROR_OBSERVED";
  if (exact === "Message-origin exec is allowed only on a node owned by the current Global ID") return "DEVICE_EXEC_SCOPE_ERROR_OBSERVED";
  // No speculative mapping of a generic 'resource scope' error to a particular guard.
  return "TOOL_ERROR_ORIGIN_UNKNOWN";
}

export function parseAutomationArguments(args: string): { selector: string; runAtMs?: number } {
  const parts = args.trim().split(/\s+/u);
  if (args.length > 250 || parts[0] !== "automation" || parts.length < 2 || parts.length > 3 || !IDENTIFIER.test(parts[1])) {
    throw new Error("USAGE: /sg_cost_diag automation project|JOB_ID [RUN_AT_MS]");
  }
  const runAtMs = parts[2] === undefined ? undefined : /^\d{10,16}$/u.test(parts[2]) ? Number(parts[2]) : NaN;
  if (runAtMs !== undefined && (!Number.isSafeInteger(runAtMs) || runAtMs <= 0)) throw new Error("INVALID_RUN_AT_MS");
  return { selector: parts[1], runAtMs };
}

export function observeTranscript(rows: unknown[], run: RecordValue): ToolObservation[] {
  const start = number(run.runAtMs);
  const end = number(run.ts) ?? (start !== undefined && number(run.durationMs) !== undefined ? start + Number(run.durationMs) : undefined);
  if (start === undefined || end === undefined || end < start) return [];
  const calls = new Map<string, ToolObservation>();
  const duplicateIds = new Set<string>();
  for (const raw of rows) {
    const row = record(raw);
    const at = timestamp(row?.timestamp);
    if (at === undefined || at < start || at > end) continue;
    const message = record(row?.message);
    if (!message) continue;
    if (message.role === "assistant" && Array.isArray(message.content)) {
      for (const item of message.content) {
        const call = record(item);
        if (call?.type !== "toolCall" || !safeLabel(call.id) || !safeLabel(call.name)) continue;
        const p = record(call.arguments) ?? {};
        const callId = String(call.id);
        if (calls.has(callId)) { calls.delete(callId); duplicateIds.add(callId); }
        if (duplicateIds.has(callId) || calls.size >= MAX_ROWS) continue;
        // Do not emit commands, patches, file contents, secrets or device IDs.
        const file = text(p.path) ?? text(p.file_path);
        const patch = text(p.patch) ?? text(p.input) ?? "";
        const targetsMemory = file === PROJECT_MEMORY || patch.split("\n").some(line => line === `*** Update File: ${PROJECT_MEMORY}` || line === `*** Add File: ${PROJECT_MEMORY}`);
        const github = /github/iu.test(String(call.name)) || call.name === "exec" && /(?:^|[\s;&|])gh\s+(?:api|repo|run|workflow|pr|issue)\b/u.test(text(p.command) ?? "");
        calls.set(callId, {
          callId, tool: String(call.name),
          requestedHost: ["node", "gateway", "sandbox"].includes(String(p.host)) ? String(p.host) : undefined,
          target: targetsMemory ? "project-memory" : github ? "github" : undefined,
          result: "unknown",
        });
        if (calls.size > MAX_ROWS) break;
      }
    } else if (message.role === "toolResult") {
      const callId = text(message.toolCallId);
      const existing = callId ? calls.get(callId) : undefined;
      if (!existing || (text(message.toolName) && message.toolName !== existing.tool)) continue;
      existing.result = message.isError === true ? "error" : "returned";
      existing.errorCode = message.isError === true ? errorFingerprint(message.content) : undefined;
      existing.errorAtMs = message.isError === true ? at : undefined;
    }
  }
  return [...calls.values()].slice(0, MAX_ROWS);
}

export function analyzeAutomationEvidence(e: AutomationEvidence): AutomationReport {
  const checks: Check[] = [];
  const add = (stage: string, status: Status, scope: "current" | "run", code: string) => checks.push({ stage, status, scope, code });
  const job = e.job;
  let run = e.run;
  const owner = record(job?.owner);
  const policy = record(job?.scheduledToolPolicy);
  const policyMode = policy?.version === 1 && policy.mode === "trusted" && Object.keys(policy).every(key => key === "version" || key === "mode")
    ? "trusted" : policy?.version === 1 && policy.mode === "account" && text(policy.ownerSessionKey) && text(policy.ownerAccountId) &&
      Object.keys(policy).every(key => ["version", "mode", "ownerSessionKey", "ownerAccountId"].includes(key)) ? "account" : undefined;
  const policyOwnerSessionKey = policyMode === "account" ? policy?.ownerSessionKey : undefined;
  const policyOwnerAccountId = policyMode === "account" ? policy?.ownerAccountId : undefined;
  add("creation", "UNKNOWN", "run", "CREATION_OR_UPDATE_AUDIT_NOT_RECORDED");
  add("saved-owner", owner && text(owner.sessionKey) ? "OBSERVED" : "UNKNOWN", "current", owner && text(owner.sessionKey) ? "OWNER_BINDING_PRESENT_NOT_GLOBAL_ID_PROOF" : "SAVED_OWNER_NOT_VERIFIED");
  if (owner && text(owner.sessionKey) && text(policyOwnerSessionKey) && text(policyOwnerAccountId)) {
    const differs = owner.sessionKey !== policyOwnerSessionKey || owner.accountId !== policyOwnerAccountId;
    add("owner-policy-binding", differs ? "MISMATCH" : "OBSERVED", "current", differs ? "OWNER_POLICY_BINDING_DIFFERS" : "OWNER_POLICY_BINDING_EQUAL");
  } else add("owner-policy-binding", "UNKNOWN", "current", "OWNER_OR_POLICY_BINDING_NOT_AVAILABLE");
  if (e.authority) {
    add("runtime-authority", e.authority.recovery_required === 1 ? "OBSERVED" : "UNKNOWN", "current", e.authority.recovery_required === 1 ? "NATIVE_AUTHORITY_RECOVERY_REQUIRED" : "AUTHORITY_ROW_PRESENT_FINGERPRINT_NOT_VERIFIED");
  } else add("runtime-authority", "UNKNOWN", "current", "RUNTIME_AUTHORITY_NOT_READ");
  if (run && job && run.jobId !== job.id) {
    add("run", "MISMATCH", "run", "RUN_JOB_ID_MISMATCH");
    run = undefined;
  } else add("run", run && number(run.runAtMs) !== undefined ? "OBSERVED" : "UNKNOWN", "run", run ? "RUN_RECORD_FOUND" : "RUN_NOT_READ");
  const changedAfter = run && job && number(job.updatedAtMs) !== undefined && number(run.runAtMs) !== undefined && Number(job.updatedAtMs) > Number(run.runAtMs);
  add("historical-config", "UNKNOWN", "run", changedAfter ? "JOB_UPDATED_AFTER_SELECTED_RUN" : "EXACT_EXECUTED_REVISION_NOT_PROVEN");
  add("global-id", "UNKNOWN", "run", "CONFIRMED_EXECUTION_PRINCIPAL_NOT_RECORDED");
  const billingConflict = e.billingJobOwner && e.billingSessionOwner && text(e.billingJobOwner.global_id) && text(e.billingSessionOwner.global_id) && e.billingJobOwner.global_id !== e.billingSessionOwner.global_id;
  add("billing", billingConflict ? "MISMATCH" : "UNKNOWN", "current", billingConflict ? "BILLING_JOB_SESSION_OWNERS_DIFFER" : "BILLING_OWNER_IS_NOT_ACCESS_AUTHORITY");
  add("effective-policy", "UNKNOWN", "run", "EXECUTED_POLICY_AND_MATCHED_SENDER_NOT_RECORDED");
  add("tool-search", "UNKNOWN", "run", "CATALOG_COUNT_IS_NOT_FINAL_ALLOWLIST");
  const calls = run ? e.calls : [];
  const blockedCall = calls.filter(c => c.errorCode === "DEVICE_IDENTITY_ERROR_OBSERVED" || c.errorCode === "DEVICE_EXEC_SCOPE_ERROR_OBSERVED").sort((a, b) => (a.errorAtMs ?? Infinity) - (b.errorAtMs ?? Infinity))[0];
  add("tool-call", blockedCall ? "BLOCKED" : "UNKNOWN", "run", blockedCall?.errorCode ?? (calls.length ? "TOOL_CALLS_OBSERVED_NO_ATTRIBUTED_DENIAL" : "NO_LINKED_TOOL_CALLS"));
  for (const target of ["github", "project-memory"] as const) {
    const errors = calls.filter(c => c.target === target && c.result === "error");
    add(target, errors.length ? "BLOCKED" : "UNKNOWN", "run", errors.length ? "LINKED_TARGET_TOOL_ERROR" : "TARGET_SUCCESS_NOT_INDEPENDENTLY_VERIFIED");
  }
  add("completion", "UNKNOWN", "run", "DELIVERY_OR_AGENT_OK_IS_NOT_TASK_VERIFICATION");
  add("cost", "UNKNOWN", "run", "EXACT_RUN_OPERATION_COST_LINK_NOT_PROVEN");
  const first = checks.find(c => c.status === "MISMATCH") ?? null;
  const status = first ? "MISMATCH" : checks.some(c => c.status === "BLOCKED") ? "BLOCKED" : "UNKNOWN";
  const usage = record(run?.usage);
  const diagnostic = record(run?.diagnostics);
  const phases = Array.isArray(diagnostic?.phases) ? diagnostic.phases : [];
  const nativePhases = phases.slice(0, 32).flatMap(value => {
    const phase = record(value);
    return phase && ["blocked", "error"].includes(String(phase.status)) ? [{
      phase: safeLabel(phase.phase), status: phase.status, errorCode: safeLabel(phase.errorCode),
      startedAtMs: number(phase.startedAtMs), endedAtMs: number(phase.endedAtMs),
    }] : [];
  });
  return {
    version: 1, baseRef: BASE_REF, jobId: safeLabel(job?.id), runAtMs: number(run?.runAtMs), status,
    first_confirmed_mismatch: first,
    first_unknown_stage: checks.find(c => c.status === "UNKNOWN")?.stage ?? null,
    first_observed_run_block: blockedCall ?? null,
    root_cause: "UNKNOWN", checks,
    facts: {
      ownerSessionHash: digest(owner?.sessionKey), policyOwnerSessionHash: digest(policyOwnerSessionKey),
      storedToolsAllow: stringList(record(job?.payload)?.toolsAllow),
      scheduledPolicyMode: policyMode ?? "UNKNOWN",
      toolsAllowIsDefault: record(job?.payload)?.toolsAllowIsDefault === true,
      toolsAllowProvenance: record(job?.toolsAllowProvenance) ? "present" : "UNKNOWN",
      currentPolicyDeclarations: e.declarations,
      billingJobOwnerHash: digest(e.billingJobOwner?.global_id),
      billingSessionOwnerHash: digest(e.billingSessionOwner?.global_id),
      billingCandidateOperations: e.billingCandidateCount ?? "UNKNOWN",
      reportedNativeUsage: usage ? { input: number(usage.input_tokens), output: number(usage.output_tokens), total: number(usage.total_tokens) } : "UNKNOWN",
      nativeFailedPhases: nativePhases,
      delivered: typeof run?.delivered === "boolean" ? run.delivered : "UNKNOWN",
      transcript: e.transcript ?? "UNKNOWN",
      calls: calls.slice(0, 12), totalObservedCalls: calls.length,
    },
    sources: e.sources,
  };
}

async function safePath(root: string, relative: string): Promise<string> {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/u).includes("..")) throw new Error("UNSAFE_PATH");
  const resolvedRoot = await realpath(root);
  const candidate = path.join(resolvedRoot, relative);
  let part = resolvedRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    part = path.join(part, segment);
    if ((await lstat(part)).isSymbolicLink()) throw new Error("SYMLINK_REFUSED");
  }
  if (await realpath(candidate) !== candidate || !(await lstat(candidate)).isFile()) throw new Error("UNSAFE_PATH");
  return candidate;
}

async function withReadOnlyDb<T>(root: string, relative: string, fn: (db: DatabaseSync) => T): Promise<T> {
  const file = await safePath(root, relative);
  // Do not create a database, run schema migrations, perform recovery or ignore WAL.
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    db.exec("PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; PRAGMA busy_timeout=250; BEGIN;");
    return fn(db);
  } finally { try { db.exec("ROLLBACK"); } finally { db.close(); } }
}
function readTranscript(db: DatabaseSync, sessionId: string, run: RecordValue, agentSource: TranscriptFacts["agentSource"], currentAgentId: string): { rows: unknown[]; facts: TranscriptFacts } {
  const fields = columns(db, "transcript_events");
  if (!["session_id", "seq", "event_json"].every(field => fields.has(field))) throw new Error("UNSUPPORTED_TRANSCRIPT_SCHEMA");
  const total = db.prepare("SELECT count(*) AS n FROM transcript_events WHERE session_id=?").get(sessionId);
  const windowFields = columns(db, "session_windows");
  const window = windowFields.has("session_id") && windowFields.has("session_key")
    ? db.prepare("SELECT session_key FROM session_windows WHERE session_id=?").get(sessionId) : undefined;
  const sessionWindow: TranscriptFacts["sessionWindow"] = windowFields.has("session_id") && windowFields.has("session_key")
    ? window ? "PRESENT" : "ABSENT" : "UNAVAILABLE";
  const sessionKeyMatch: TranscriptFacts["sessionKeyMatch"] = text(window?.session_key) && text(run.sessionKey)
    ? window?.session_key === run.sessionKey ? "EQUAL" : "DIFFERS" : "UNKNOWN";
  const archiveFields = columns(db, "session_transcript_archives");
  const archivedGenerations = archiveFields.has("session_id")
    ? number(db.prepare("SELECT count(*) AS n FROM session_transcript_archives WHERE session_id=?").get(sessionId)?.n) ?? "UNKNOWN"
    : "UNKNOWN";
  // Native per-agent SQLite is the transcript owner. Bound rows and bytes, and never read raw
  // command text into the report. An oversized or malformed event makes the source partial.
  const events = db.prepare(`SELECT CASE WHEN length(CAST(event_json AS BLOB)) <= 65536
    THEN event_json ELSE NULL END AS event_json FROM transcript_events
    WHERE session_id=? ORDER BY seq DESC LIMIT ?`).all(sessionId, MAX_ROWS + 1);
  const rows: unknown[] = [];
  let bytes = 0;
  let truncated = events.length > MAX_ROWS;
  for (const event of events.slice(0, MAX_ROWS).reverse()) {
    if (typeof event.event_json !== "string") { truncated = true; continue; }
    bytes += Buffer.byteLength(event.event_json);
    if (bytes > MAX_BYTES) { truncated = true; continue; }
    try { rows.push(JSON.parse(event.event_json)); } catch { truncated = true; }
  }
  const start = number(run.runAtMs);
  const end = number(run.ts) ?? (start !== undefined && number(run.durationMs) !== undefined ? start + Number(run.durationMs) : undefined);
  let eventsInRunWindow = 0;
  let assistantToolCallsInWindow = 0;
  let toolResultsInWindow = 0;
  const times: number[] = [];
  for (const event of rows) {
    const row = record(event);
    const at = timestamp(row?.timestamp);
    if (at !== undefined) times.push(at);
    if (at === undefined || start === undefined || end === undefined || at < start || at > end) continue;
    eventsInRunWindow++;
    const message = record(row?.message);
    if (message?.role === "assistant" && Array.isArray(message.content)) {
      assistantToolCallsInWindow += message.content.filter(item => record(item)?.type === "toolCall").length;
    }
    if (message?.role === "toolResult") toolResultsInWindow++;
  }
  return { rows, facts: {
    agentSource,
    runAgentMatchesCurrent: text(run.agentId) ? run.agentId === currentAgentId : "UNKNOWN",
    sessionWindow, sessionKeyMatch, archivedGenerations,
    totalEvents: number(total?.n) ?? 0, selectedEvents: Math.min(events.length, MAX_ROWS), parsedEvents: rows.length,
    eventsInRunWindow, assistantToolCallsInWindow, toolResultsInWindow,
    firstSelectedAtMs: times.length ? Math.min(...times) : undefined,
    lastSelectedAtMs: times.length ? Math.max(...times) : undefined,
    partial: truncated,
  } };
}
function columns(db: DatabaseSync, table: string): Set<string> {
  if (!/^[a-z_]+$/u.test(table)) throw new Error("UNSUPPORTED_SCHEMA");
  return new Set(db.prepare("SELECT name FROM pragma_table_info(?)").all(table).map(row => String(row.name)));
}
function safeFailure(error: unknown): string {
  const code = record(error)?.code;
  if (code === "ENOENT") return "SOURCE_NOT_FOUND";
  if (code === "EACCES" || code === "EPERM") return "SOURCE_NOT_READABLE";
  const reason = error instanceof Error ? error.message : "";
  return /^[A-Z_]{3,80}$/u.test(reason) ? reason : "READ_FAILED";
}
function pickColumns(available: Set<string>, names: string[]): string {
  return names.filter(n => available.has(n)).map(n => n.endsWith("_json")
    ? `CASE WHEN length(CAST("${n}" AS BLOB)) <= ${MAX_BYTES} THEN "${n}" ELSE NULL END AS "${n}"`
    : `"${n}"`).join(", ");
}

export async function readAutomationEvidence(input: {
  stateDir: string; selector: string; runAtMs?: number; config: unknown;
}): Promise<AutomationEvidence> {
  if (!IDENTIFIER.test(input.selector)) throw new Error("INVALID_SELECTOR");
  const evidence: AutomationEvidence = { calls: [], sources: [] };
  const config = record(input.config);
  const tools = record(config?.tools);
  const bySender = record(tools?.toolsBySender);
  evidence.declarations = { global: publicPolicy(tools), defaultSender: publicPolicy(bySender?.["*"]), historicalEffective: "UNKNOWN" };
  const note = (name: string, error?: unknown, truncated?: boolean) => evidence.sources.push({ name, status: error ? "UNKNOWN" : "OBSERVED", reason: error ? safeFailure(error) : undefined, truncated });
  try {
    await withReadOnlyDb(input.stateDir, "state/openclaw.sqlite", db => {
      const schema = columns(db, "cron_jobs");
      if (!schema.has("job_json") || !schema.has("job_id") || !schema.has("store_key")) throw new Error("UNSUPPORTED_CRON_SCHEMA");
      const select = pickColumns(schema, ["job_id", "store_key", "job_json", "state_json", "updated_at_ms"]);
      const predicate = input.selector === "project"
        ? "json_valid(job_json) AND json_extract(job_json, '$.enabled')=1 AND instr(json_extract(job_json, '$.payload.message'), ?) > 0 AND instr(json_extract(job_json, '$.payload.message'), ?) > 0"
        : "job_id = ?";
      const bindings = input.selector === "project" ? [PROJECT_MEMORY, PROJECT_REPOSITORY] : [input.selector];
      const rows = db.prepare(`SELECT ${select} FROM cron_jobs WHERE ${predicate} LIMIT 2`).all(...bindings);
      if (rows.length !== 1) throw new Error(rows.length ? "AMBIGUOUS_PROJECT_JOB" : "PROJECT_JOB_NOT_FOUND");
      const row = rows[0];
      const job = parseObject(row.job_json);
      if (!job || job.id !== row.job_id || !projectJob(job)) throw new Error("PROJECT_SCOPE_NOT_PROVEN");
      if (Buffer.byteLength(String(row.job_json)) > MAX_BYTES) throw new Error("JOB_TOO_LARGE");
      if (number(row.updated_at_ms) !== undefined) job.updatedAtMs = row.updated_at_ms;
      evidence.job = job;
      note("active-cron-partition", new Error("ACTIVE_PARTITION_NOT_INDEPENDENTLY_VERIFIED"));
      const state = parseObject(row.state_json);
      note("cron_jobs:current-config");
      const authorityColumns = columns(db, "cron_job_runtime_authorities");
      if (authorityColumns.has("recovery_required") && authorityColumns.has("store_key") && authorityColumns.has("job_id")) {
        const authoritySelect = pickColumns(authorityColumns, ["recovery_required", "authority_input_fingerprint"]);
        evidence.authority = db.prepare(`SELECT ${authoritySelect} FROM cron_job_runtime_authorities WHERE store_key=? AND job_id=?`).get(String(row.store_key), String(row.job_id)) as RecordValue | undefined;
        note("cron_job_runtime_authorities", evidence.authority ? undefined : new Error("AUTHORITY_ROW_ABSENT"));
      } else note("cron_job_runtime_authorities", new Error("AUTHORITY_TABLE_UNAVAILABLE"));
      // Current OpenClaw stores cron history in the shared task ledger.
      const taskFields = columns(db, "task_runs");
      let taskRunAmbiguous = false;
      if (["runtime", "source_id", "started_at", "ended_at", "child_session_key", "detail_json"].every(c => taskFields.has(c))) {
      const taskRows = db.prepare(`SELECT started_at, ended_at, child_session_key, ${taskFields.has("agent_id") ? "agent_id" : "NULL AS agent_id"},
          CASE WHEN length(CAST(detail_json AS BLOB)) <= ${MAX_BYTES} THEN detail_json ELSE NULL END AS detail_json
          FROM task_runs WHERE runtime='cron' AND source_id=?
          ${input.runAtMs !== undefined ? "AND started_at=?" : ""}
          ORDER BY started_at DESC LIMIT 32`).all(
            String(row.job_id), ...(input.runAtMs !== undefined ? [input.runAtMs] : []),
          );
        const taskRuns = taskRows.flatMap(item => {
          const detail = parseObject(item.detail_json);
          if (detail?.kind !== "cron-run" || detail.storeKey !== row.store_key ||
              number(item.started_at) === undefined || number(item.ended_at) === undefined ||
              (number(detail.runAtMs) !== undefined && detail.runAtMs !== item.started_at)) return [];
          return [{ jobId: job.id, runAtMs: item.started_at, ts: item.ended_at,
            durationMs: number(detail.durationMs), sessionId: detail.sessionId,
            sessionKey: item.child_session_key, agentId: item.agent_id, diagnostics: detail.diagnostics,
            usage: detail.usage, delivered: detail.delivered, runId: detail.runId }];
        });
        if (taskRuns.length > 1 && taskRuns[0].runAtMs === taskRuns[1].runAtMs) {
          taskRunAmbiguous = true;
          note("task_runs:cron-history", new Error("AMBIGUOUS_RUN"));
        } else if (taskRuns.length && input.runAtMs === undefined &&
                   number(state?.lastRunAtMs) !== undefined &&
                   Number(state?.lastRunAtMs) > Number(taskRuns[0].runAtMs)) {
          note("task_runs:cron-history", new Error("RUN_HISTORY_BEHIND_CURRENT_STATE"));
        } else if (taskRuns.length) {
          evidence.run = taskRuns[0];
          note("task_runs:cron-history", undefined, taskRows.length === 32);
        } else note("task_runs:cron-history", new Error("RUN_NOT_FOUND"));
      } else note("task_runs:cron-history", new Error("UNSUPPORTED_SCHEMA"));
      if (!evidence.run && !taskRunAmbiguous) {
      // Discover legacy cron run tables with a strict supported row shape.
      const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE 'cron%run%' LIMIT 33").all();
      const candidates: RecordValue[] = [];
      let ambiguousRun = false;
      if (tables.length > 32) throw new Error("CRON_SCHEMA_LIMIT");
      for (const table of tables) {
        const name = String(table.name);
        const fields = columns(db, name);
        if (!fields.has("job_id") || !fields.has("run_at_ms")) continue;
        const selected = pickColumns(fields, ["job_id", "run_at_ms", "ts", "run_id", "session_id", "session_key", "status", "delivered", "duration_ms", "entry_json", "run_json", "diagnostics_json", "usage_json"]);
        let where = "job_id=?";
        const values: (string | number)[] = [String(row.job_id)];
        if (fields.has("store_key")) { where += " AND store_key=?"; values.push(String(row.store_key)); }
        if (input.runAtMs !== undefined) { where += " AND run_at_ms=?"; values.push(input.runAtMs); }
        const found = db.prepare(`SELECT ${selected} FROM "${name}" WHERE ${where} ORDER BY run_at_ms DESC LIMIT 2`).all(...values);
        if (!found.length) continue;
        if (found.length > 1 && found[0].run_at_ms === found[1].run_at_ms) { note(name, new Error("AMBIGUOUS_RUN")); ambiguousRun = true; continue; }
        const item = found[0];
        const json = parseObject(item.entry_json) ?? parseObject(item.run_json);
        const run: RecordValue = json ?? {
          jobId: item.job_id, runAtMs: item.run_at_ms, ts: item.ts,
          runId: item.run_id, sessionId: item.session_id, sessionKey: item.session_key,
          status: item.status, delivered: item.delivered === 1 ? true : item.delivered === 0 ? false : undefined,
          durationMs: item.duration_ms, diagnostics: parseObject(item.diagnostics_json), usage: parseObject(item.usage_json),
        };
        if (run.jobId === job.id && number(run.runAtMs) !== undefined && run.runAtMs === item.run_at_ms && (input.runAtMs === undefined || run.runAtMs === input.runAtMs)) candidates.push(run);
        else { ambiguousRun = true; note(name, new Error("RUN_ROW_JSON_MISMATCH")); }
      }
      if (ambiguousRun) note("native-cron-run-row", new Error("AMBIGUOUS_RUN_SOURCE"));
      else if (candidates.length === 1) {
        if (input.runAtMs === undefined && number(state?.lastRunAtMs) !== undefined && Number(state?.lastRunAtMs) > Number(candidates[0].runAtMs)) note("native-cron-run-row", new Error("RUN_HISTORY_BEHIND_CURRENT_STATE"));
        else { evidence.run = candidates[0]; note("native-cron-run-row"); }
      } else if (candidates.length > 1) note("native-cron-run-row", new Error("AMBIGUOUS_RUN_SOURCE"));
      else if (state && number(state.lastRunAtMs) !== undefined && (input.runAtMs === undefined || input.runAtMs === state.lastRunAtMs)) {
        evidence.run = { jobId: job.id, runAtMs: state.lastRunAtMs, durationMs: state.lastDurationMs, diagnostics: state.lastDiagnostics, status: state.lastRunStatus, delivered: state.lastDelivered, usage: state.lastUsage };
        note("cron_jobs:last-state-not-immutable-run-history");
      } else note("native-cron-run-row", new Error("RUN_NOT_FOUND_OR_UNSUPPORTED_SCHEMA"));
      }
    });
  } catch (error) { note("native-cron-database", error); }
  const job = evidence.job;
  const run = evidence.run;
  const sessionId = text(run?.sessionId);
  const currentAgentId = text(job?.agentId) ?? "main";
  const agentId = text(run?.agentId) ?? currentAgentId;
  if (sessionId && IDENTIFIER.test(sessionId) && IDENTIFIER.test(agentId) && run) {
    try {
      const result = await withReadOnlyDb(input.stateDir, `agents/${agentId}/agent/openclaw-agent.sqlite`, db => readTranscript(db, sessionId, run, text(run.agentId) ? "run" : "current-job", currentAgentId));
      evidence.calls = observeTranscript(result.rows, run);
      evidence.transcript = result.facts;
      note("native-session-transcript", undefined, result.facts.partial);
    } catch (error) { note("native-session-transcript", error); }
  } else note("native-session-transcript", new Error("EXACT_RUN_SESSION_NOT_AVAILABLE"));
  if (job) {
    try {
      await withReadOnlyDb(input.stateDir, "sg/billing.sqlite", db => {
        const ownerColumns = columns(db, "sg_billing_automation_owners");
        if (ownerColumns.has("job_id") && ownerColumns.has("global_id")) {
          evidence.billingJobOwner = db.prepare("SELECT global_id FROM sg_billing_automation_owners WHERE job_id=?").get(String(job.id)) as RecordValue | undefined;
        }
        if (text(run?.sessionKey) && columns(db, "sg_billing_session_owners").has("session_key")) {
          evidence.billingSessionOwner = db.prepare("SELECT global_id FROM sg_billing_session_owners WHERE session_key=?").get(String(run?.sessionKey)) as RecordValue | undefined;
        }
        const fields = columns(db, "sg_billing_operations");
        const start = number(run?.runAtMs);
        const end = number(run?.ts) ?? (start !== undefined && number(run?.durationMs) !== undefined ? start + Number(run?.durationMs) : undefined);
        if (start !== undefined && end !== undefined && ["source_kind", "source_id", "created_at"].every(c => fields.has(c))) {
          const candidates = db.prepare("SELECT operation_id FROM sg_billing_operations WHERE source_kind='automation' AND source_id=? AND created_at>=? AND created_at<=? LIMIT 129").all(String(job.id), start, end);
          if (candidates.length <= MAX_ROWS) evidence.billingCandidateCount = candidates.length;
          // A time-window match never becomes a confirmed run-operation link or a cost total.
        }
      });
      note("sg-billing:owner-bindings-and-candidates");
    } catch (error) { note("sg-billing:owner-bindings-and-candidates", error); }
  }
  return evidence;
}

export function formatSgAutomationDiagnostic(report: AutomationReport): string {
  const mismatch = report.first_confirmed_mismatch;
  const first = report.first_observed_run_block;
  const calls = report.facts.calls as ToolObservation[];
  return [
    `SG AUTOMATION DIAG — ${report.status}`,
    `Job: ${report.jobId ?? "UNKNOWN"}; запуск: ${report.runAtMs ? new Date(report.runAtMs).toISOString() : "UNKNOWN"}`,
    `Первое доказанное расхождение: ${mismatch ? `${mismatch.stage}/${mismatch.code} (${mismatch.scope})` : "UNKNOWN"}`,
    `Первое неизвестное звено: ${report.first_unknown_stage ?? "нет"}`,
    `Отказ инструмента: ${first ? `${first.tool}; ${first.errorCode}; call=${first.callId}` : "UNKNOWN"}`,
    `Вызовы выбранного запуска (${calls.length}/${report.facts.totalObservedCalls}; returned ≠ успех):`,
    ...calls.map(c => `tool=${c.tool}; status=${c.result}; code=${c.errorCode ?? "UNKNOWN"}; target=${c.target ?? "UNKNOWN"}; host=${c.requestedHost ?? "UNKNOWN"}`),
    `Транскрипт выбранного запуска: ${JSON.stringify(report.facts.transcript)}`,
    "Причина всего сбоя: UNKNOWN — требуется доказательство всей связи, не пересказ модели.",
    ...report.checks.filter(c => c.status !== "UNKNOWN").slice(0, 8).map(c => `${c.status} [${c.scope}] ${c.stage}: ${c.code}`),
    `Источники: ${report.sources.map(s => `${s.name}=${s.status}${s.reason ? `:${s.reason}` : ""}${s.truncated ? ":PARTIAL" : ""}`).join("; ")}`,
    `Текущие декларации политик (НЕ итоговая политика запуска): ${JSON.stringify(report.facts.currentPolicyDeclarations)}`,
    `Сохранённые toolsAllow: ${JSON.stringify(report.facts.storedToolsAllow ?? "UNKNOWN")}; scheduledToolPolicy.mode: ${JSON.stringify(report.facts.scheduledPolicyMode ?? "UNKNOWN")}`,
    "Доставка ≠ выполнение. Плательщик ≠ полномочия. Расходы без точной связи запуска: UNKNOWN.",
  ].join("\n").slice(0, 3700);
}

/** The actor must come from SG's existing read-only identity resolver, never request arguments. */
export async function buildSgAutomationDiagnostic(input: {
  stateDir: string; args: string; config: unknown;
  actor?: { globalId: string; role: string; status: string };
}): Promise<string> {
  if (!input.actor?.globalId || input.actor.role !== "monarch" || input.actor.status !== "active") return "SG AUTOMATION DIAG — доступ разрешён только подтверждённому монарху";
  try {
    const parsed = parseAutomationArguments(input.args);
    return formatSgAutomationDiagnostic(analyzeAutomationEvidence(await readAutomationEvidence({ ...input, ...parsed })));
  } catch (error) {
    return `SG AUTOMATION DIAG — ${error instanceof Error && (error.message.startsWith("USAGE:") || error.message === "INVALID_RUN_AT_MS") ? error.message : "UNKNOWN: diagnostic failed"}`;
  }
}
