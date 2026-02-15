// src/jobs/jobRunner.js
// 2.7.1 JOB QUEUE / WORKERS (SKELETON)
// Contract: enqueue/run/ack/fail
// NOTE: no scaling, no real queue yet. In-memory placeholder.

export class JobRunner {
  constructor() {
    this._queue = [];
    this._running = false;
  }

  // enqueue(job) -> returns jobId
  enqueue(job) {
    const jobId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    this._queue.push({
      id: jobId,
      job,
      status: "queued",
      created_at: new Date().toISOString(),
    });
    return jobId;
  }

  // runOnce(handler) -> runs one job if exists
  async runOnce(handler) {
    if (this._running) return { ran: false, reason: "already_running" };
    const item = this._queue.shift();
    if (!item) return { ran: false, reason: "empty" };

    this._running = true;
    item.status = "running";

    try {
      await handler(item.job);
      await this.ack(item.id);
      return { ran: true, id: item.id, status: "acked" };
    } catch (e) {
      await this.fail(item.id, e);
      return { ran: true, id: item.id, status: "failed", error: String(e?.message || e) };
    } finally {
      this._running = false;
    }
  }

  async ack(jobId) {
    // skeleton: in real impl, mark task_run as success
    return { ok: true, id: jobId };
  }

  async fail(jobId, error) {
    // skeleton: in real impl, mark task_run as failed + store error
    return { ok: false, id: jobId, error: String(error?.message || error) };
  }
}
