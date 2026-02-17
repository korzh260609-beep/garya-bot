// src/jobs/jobRunner.js
// 2.7.1 JOB QUEUE / WORKERS (SKELETON)
// 2.7.2 idempotency_key (task_run_key) — prevent duplicate enqueues in-memory
// 2.7.4 DLQ skeleton (exists but disabled) — stub only, NO real queue/storage yet
// Contract: enqueue/run/ack/fail
// NOTE: no scaling, no real queue yet. In-memory placeholder.

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

  // run(handler) -> alias for runOnce(handler) to satisfy the contract: enqueue/run/ack/fail
  async run(handler) {
    return this.runOnce(handler);
  }

  // runOnce(handler) -> runs one job if exists
  async runOnce(handler) {
    if (this._running) return { ran: false, reason: "already_running" };
    const item = this._queue.shift();
    if (!item) return { ran: false, reason: "empty" };

    this._running = true;
    item.status = "running";

    try {
      await handler(item.job, { jobId: item.id, idempotencyKey: item.idempotency_key });
      await this.ack(item.id, item.idempotency_key);
      return { ran: true, id: item.id, status: "acked" };
    } catch (e) {
      await this.fail(item.id, item.idempotency_key, e, item);
      return { ran: true, id: item.id, status: "failed", error: String(e?.message || e) };
    } finally {
      this._running = false;
    }
  }

  async ack(jobId, idempotencyKey) {
    // skeleton: in real impl, mark task_run as success
    this._releaseKey(idempotencyKey);
    return { ok: true, id: jobId };
  }

  async fail(jobId, idempotencyKey, error, item) {
    // skeleton: in real impl, mark task_run as failed + store error
    // DLQ skeleton (disabled): if enabled, push minimal record
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
      // DLQ is best-effort even when enabled (skeleton)
      console.error("⚠️ DLQ move failed (skeleton):", e);
    }

    this._releaseKey(idempotencyKey);
    return { ok: false, id: jobId, error: String(error?.message || error) };
  }

  // DLQ API (skeleton)
  enableDLQ(enabled = true) {
    this._dlqEnabled = !!enabled;
    return { ok: true, enabled: this._dlqEnabled };
  }

  // returns a copy (skeleton)
  getDLQ() {
    return Array.isArray(this._dlq) ? [...this._dlq] : [];
  }

  async _moveToDLQ(record) {
    // skeleton: later will write to DB table (dlq) + metrics
    this._dlq.push(record);
    return { ok: true };
  }

  _releaseKey(idempotencyKey) {
    if (!idempotencyKey) return;
    this._keys.delete(idempotencyKey);
    this._keyToJobId.delete(idempotencyKey);
  }
}

// helper (skeleton): deterministic key generator for tasks
export function makeTaskRunKey({ taskId, scheduledForIso }) {
  // minimal deterministic format; later будет unique в DB (task_run_key)
  return `task:${String(taskId)}@${String(scheduledForIso || "")}`;
}
