// src/jobs/jobRunner.js
// 2.7.1 JOB QUEUE / WORKERS (SKELETON)
// 2.7.2 idempotency_key (task_run_key) — prevent duplicate enqueues in-memory
// 2.7.4 DLQ skeleton (exists but disabled) — stub only, NO real queue/storage yet
// Stage 2.8 — Runtime Dedup (task_runs table)
// Stage 5 — Observability V1: task_runs + error_events writing (safe)
// Contract: enqueue/run/ack/fail
// NOTE: no scaling, no real queue yet. In-memory placeholder.

import { tryStartTaskRun, finishTaskRun } from "../db/taskRunsRepo.js";
import { ErrorEventsRepo } from "../db/errorEventsRepo.js";
import pool from "../../db.js";

function safeErrMsg(e, max = 800) {
  const s = String(e?.message || e || "unknown_error");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
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
      // Close task_runs (failed)
      // ================================
      try {
        if (taskId && runKey && startedRunGate) {
          await finishTaskRun({ taskId, runKey, status: "failed" });
        }
      } catch (_) {}

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
