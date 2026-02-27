// src/jobs/jobRunner.js
// 2.7.1 JOB QUEUE / WORKERS (SKELETON)
// 2.7.2 idempotency_key (task_run_key) — prevent duplicate enqueues in-memory
// 2.7.4 DLQ (DB-backed V0, disabled by default)
// Stage 2.8 — Runtime Dedup (task_runs table)
// Stage 5 — Observability V1: task_runs + error_events writing (safe)

import {
  tryStartTaskRun,
  finishTaskRun,
  getTaskRunAttempts,
  markTaskRunFailed,
} from "../db/taskRunsRepo.js";
import { ErrorEventsRepo } from "../db/errorEventsRepo.js";
import {
  getRetryPolicy,
  computeBackoffDelayMs,
  shouldRetry,
} from "./retryPolicy.js";
import { DlqRepo } from "../db/dlqRepo.js";
import pool from "../../db.js";

// ✅ Stage 5 — ERROR EVENTS policy (ignore TEST_FAIL, etc.)
import { shouldIgnoreErrorEvent } from "../observability/errorEventsPolicy.js";

function safeErrMsg(e, max = 800) {
  const s = String(e?.message || e || "unknown_error");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ✅ Normalize fail_code for stable aggregation
function normalizeFailCode(e) {
  const msg = String(e?.message || "").toLowerCase();
  const name = String(e?.name || "").toLowerCase();
  const code = String(e?.code || "").toLowerCase();

  if (
    code.includes("econnreset") ||
    code.includes("etimedout") ||
    code.includes("enotfound") ||
    code.includes("eai_again") ||
    code.includes("econnrefused") ||
    msg.includes("timeout") ||
    name.includes("timeout") ||
    msg.includes("network")
  ) {
    return "NETWORK";
  }

  const httpStatus =
    e?.status ||
    e?.statusCode ||
    e?.httpStatus ||
    e?.response?.status ||
    null;

  if (Number.isInteger(httpStatus)) {
    if (httpStatus >= 500) return "HTTP_5XX";
    if (httpStatus >= 400) return "HTTP_4XX";
    return "HTTP_OTHER";
  }

  if (
    code.startsWith("pg") ||
    msg.includes("postgres") ||
    msg.includes("sql") ||
    msg.includes("relation") ||
    msg.includes("duplicate key") ||
    msg.includes("violates")
  ) {
    return "DB";
  }

  if (
    name.includes("typeerror") ||
    name.includes("referenceerror") ||
    msg.includes("undefined") ||
    msg.includes("cannot read") ||
    msg.includes("is not a function")
  ) {
    return "LOGIC";
  }

  return String(e?.code || e?.name || "UNKNOWN").toUpperCase().slice(0, 60);
}

async function safeLogErrorEvent({
  type,
  message,
  context = {},
  severity = "error",
}) {
  try {
    const repo = new ErrorEventsRepo(pool);
    await repo.logError({
      type: String(type || "error"),
      message: safeErrMsg(message),
      context: context || {},
      severity,
    });
  } catch (_) {
    // never crash worker because of logging
  }
}

function envTrue(name) {
  return String(process.env[name] || "").toLowerCase() === "true";
}

export class JobRunner {
  constructor() {
    this._queue = [];
    this._running = false;

    this._keys = new Set();
    this._keyToJobId = new Map();

    // DLQ mirror (debug) + DB writer (optional)
    this._dlq = [];
    this._dlqEnabled = envTrue("JOB_DLQ_ENABLED"); // default OFF unless ENV=true
  }

  enqueue(job, { idempotencyKey } = {}) {
    if (idempotencyKey) {
      if (this._keys.has(idempotencyKey)) {
        return {
          jobId: this._keyToJobId.get(idempotencyKey),
          accepted: false,
          reason: "duplicate_idempotency_key",
        };
      }
    }

    const jobId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const item = {
      id: jobId,
      job,
      status: "queued",
      idempotency_key: idempotencyKey || null,
      created_at: new Date().toISOString(),
    };

    this._queue.push(item);

    if (idempotencyKey) {
      this._keys.add(idempotencyKey);
      this._keyToJobId.set(idempotencyKey, jobId);
    }

    return { jobId, accepted: true };
  }

  async run(handler) {
    return this.runOnce(handler);
  }

  async runOnce(handler) {
    if (this._running) return { ran: false, reason: "already_running" };

    const item = this._queue.shift();
    if (!item) return { ran: false, reason: "empty" };

    this._running = true;
    item.status = "running";

    const taskId = item?.job?.taskId ?? item?.job?.task_id ?? null;
    const runKey = item?.job?.runKey ?? item?.job?.run_key ?? null;

    let startedRunGate = false;

    try {
      if (taskId && runKey) {
        const gate = await tryStartTaskRun({
          taskId,
          runKey,
          meta: item?.job?.meta || {},
        });

        if (!gate.started) {
          await this.ack(item.id, item.idempotency_key);
          return { ran: true, id: item.id, status: "skipped_dedup" };
        }

        startedRunGate = true;
      }

      await handler(item.job, {
        jobId: item.id,
        idempotencyKey: item.idempotency_key,
      });

      if (taskId && runKey && startedRunGate) {
        await finishTaskRun({ taskId, runKey, status: "completed" });
      }

      await this.ack(item.id, item.idempotency_key);
      return { ran: true, id: item.id, status: "acked" };
    } catch (e) {
      let attempts = 1;
      let retryAtIso = null;
      let maxRetries = null;
      let failCode = "UNKNOWN";

      try {
        if (taskId && runKey && startedRunGate) {
          const policy = getRetryPolicy();
          maxRetries = policy?.maxRetries ?? null;

          attempts = (await getTaskRunAttempts({ taskId, runKey })) ?? 1;

          const failReason = safeErrMsg(e);
          failCode = normalizeFailCode(e);

          if (shouldRetry(attempts, policy)) {
            const delayMs = computeBackoffDelayMs(attempts, policy);
            retryAtIso = new Date(Date.now() + delayMs).toISOString();
          }

          await markTaskRunFailed({
            taskId,
            runKey,
            failReason,
            failCode,
            retryAtIso,
            maxRetries,
          });
        }
      } catch (_) {}

      // ✅ Stage 5 — ignore synthetic TEST_FAIL (do not write to error_events)
      const ignore = shouldIgnoreErrorEvent({
        type: "job_runner_failed",
        message: e,
      });

      if (!ignore) {
        await safeLogErrorEvent({
          type: "job_runner_failed",
          message: e,
          context: {
            jobId: item?.id || null,
            taskId: taskId || null,
            runKey: runKey || null,
            idempotencyKey: item?.idempotency_key || null,
            fail_code: failCode,
            attempts,
            retry_at: retryAtIso,
            max_retries: maxRetries,
          },
        });
      }

      await this.fail(item.id, item.idempotency_key, e, item);
      return {
        ran: true,
        id: item.id,
        status: "failed",
        error: String(e?.message || e),
      };
    } finally {
      this._running = false;
    }
  }

  async ack(jobId, idempotencyKey) {
    this._releaseKey(idempotencyKey);
    return { ok: true, id: jobId };
  }

  async fail(jobId, idempotencyKey, error, item) {
    try {
      if (this._dlqEnabled) {
        await this._moveToDLQ({
          id: jobId,
          idempotency_key: idempotencyKey || null,
          failed_at: new Date().toISOString(),
          error: String(error?.message || error),
          job: item?.job,
        });
      }
    } catch (e) {
      console.error("⚠️ DLQ move failed:", e);
    }

    this._releaseKey(idempotencyKey);
    return { ok: false, id: jobId, error: String(error?.message || error) };
  }

  enableDLQ(enabled = true) {
    // allow ENV hard-enable too
    this._dlqEnabled = envTrue("JOB_DLQ_ENABLED") || !!enabled;
    return { ok: true, enabled: this._dlqEnabled };
  }

  getDLQ() {
    return Array.isArray(this._dlq) ? [...this._dlq] : [];
  }

  async _moveToDLQ(record) {
    // in-memory mirror
    this._dlq.push(record);

    // DB-backed
    try {
      const repo = new DlqRepo(pool);
      const taskId = record?.job?.taskId ?? record?.job?.task_id ?? null;
      const runKey = record?.job?.runKey ?? record?.job?.run_key ?? null;

      await repo.insertDlq({
        job_id: record?.id,
        idempotency_key: record?.idempotency_key || null,
        task_id: taskId,
        run_key: runKey,
        error: record?.error || "unknown_error",
        job: record?.job || null,
        context: { failed_at: record?.failed_at || null },
      });
    } catch (_) {
      // fail-open
    }

    return { ok: true };
  }

  _releaseKey(idempotencyKey) {
    if (!idempotencyKey) return;
    this._keys.delete(idempotencyKey);
    this._keyToJobId.delete(idempotencyKey);
  }
}

export function makeTaskRunKey({ taskId, scheduledForIso }) {
  return `task:${String(taskId)}@${String(scheduledForIso || "")}`;
}
