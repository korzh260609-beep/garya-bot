// src/jobs/jobRunner.js
// 2.7.1 JOB QUEUE / WORKERS (SKELETON)
// 2.7.2 idempotency_key (task_run_key) — prevent duplicate enqueues in-memory
// 2.7.4 DLQ skeleton (exists but disabled) — stub only, NO real queue/storage yet
// Stage 2.8 — Runtime Dedup (task_runs table)
// Stage 5 — Observability V1: task_runs + error_events writing (safe)
// Contract: enqueue/run/ack/fail
// NOTE: no scaling, no real queue yet. In-memory placeholder.

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
import pool from "../../db.js";

function safeErrMsg(e, max = 800) {
  const s = String(e?.message || e || "unknown_error");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ✅ Normalize fail_code for stable aggregation
// Goal: small set of buckets, no random strings.
function normalizeFailCode(e) {
  const msg = String(e?.message || "").toLowerCase();
  const name = String(e?.name || "").toLowerCase();
  const code = String(e?.code || "").toLowerCase();

  // network-ish
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

  // HTTP-ish (if upstream throws with status)
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

  // DB-ish
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

  // Logic-ish
  if (
    name.includes("typeerror") ||
    name.includes("referenceerror") ||
    msg.includes("undefined") ||
    msg.includes("cannot read") ||
    msg.includes("is not a function")
  ) {
    return "LOGIC";
  }

  // fallback
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

export class JobRunner {
  constructor() {
    this._queue = [];
    this._running = false;

    // idempotency keys currently queued/running
    this._keys = new Set();
    // map key -> jobId (so caller can reuse)
    this._keyToJobId = new Map();

    // DLQ storage (disabled by default; in-memory stub)
    this._dlq = [];
    this._dlqEnabled = false;
  }

  // enqueue(job, { idempotencyKey }) -> returns { jobId, accepted, reason? }
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

    // runtime dedup keys
    const taskId = item?.job?.taskId ?? item?.job?.task_id ?? null;
    const runKey = item?.job?.runKey ?? item?.job?.run_key ?? null;

    // remember if we actually started a DB run
    let startedRunGate = false;

    try {
      // ================================
      // Stage 2.8 — Runtime Dedup Gate
      // ================================
      if (taskId && runKey) {
        const gate = await tryStartTaskRun({
          taskId,
          runKey,
          meta: item?.job?.meta || {},
        });

        // already started elsewhere → skip
        if (!gate.started) {
          await this.ack(item.id, item.idempotency_key);
          return { ran: true, id: item.id, status: "skipped_dedup" };
        }

        startedRunGate = true;
      }

      // ================================
      // Actual execution
      // ================================
      await handler(item.job, {
        jobId: item.id,
        idempotencyKey: item.idempotency_key,
      });

      // ================================
      // Close task_runs (completed)
      // ================================
      if (taskId && runKey && startedRunGate) {
        await finishTaskRun({ taskId, runKey, status: "completed" });
      }

      await this.ack(item.id, item.idempotency_key);
      return { ran: true, id: item.id, status: "acked" };
    } catch (e) {
      // ================================
      // Stage 5.4 — retries / fail-reasons (write fields)
      // NOTE: we only RECORD retry plan in DB (no auto-retry execution here).
      // ================================
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
      } catch (_) {
        // do not block fail path
      }

      // ================================
      // error_events (safe)
      // ================================
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
      console.error("⚠️ DLQ move failed (skeleton):", e);
    }

    this._releaseKey(idempotencyKey);
    return { ok: false, id: jobId, error: String(error?.message || error) };
  }

  enableDLQ(enabled = true) {
    this._dlqEnabled = !!enabled;
    return { ok: true, enabled: this._dlqEnabled };
  }

  getDLQ() {
    return Array.isArray(this._dlq) ? [...this._dlq] : [];
  }

  async _moveToDLQ(record) {
    this._dlq.push(record);
    return { ok: true };
  }

  _releaseKey(idempotencyKey) {
    if (!idempotencyKey) return;
    this._keys.delete(idempotencyKey);
    this._keyToJobId.delete(idempotencyKey);
  }
}

// deterministic key generator
export function makeTaskRunKey({ taskId, scheduledForIso }) {
  return `task:${String(taskId)}@${String(scheduledForIso || "")}`;
}
