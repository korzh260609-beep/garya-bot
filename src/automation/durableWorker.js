import { createDurableExecutionOutcomeError, evaluateDurableExecutionResult } from './workflowFailurePolicy.js';

function requiredFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be a function`);
  return value;
}

function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer`);
  return value;
}

const EVENT_CLASS_MAP = Object.freeze({
  worker_task_claimed: 'capability_started',
  worker_action_gate_decision: 'action_gate_decision',
  worker_task_completed: 'capability_completed',
  worker_task_retry_scheduled: 'capability_failed',
  worker_task_deferred: 'audit_event',
  worker_task_dead_lettered: 'capability_failed',
  worker_task_recovered: 'audit_event'
});

export function createDurableWorker({
  workerId,
  queue,
  actionGate,
  executor,
  observability = { record() {}, recordFailure() {} },
  environment = 'worker',
  revision = 'unknown',
  leaseMs = 30000,
  heartbeatMs = 10000,
  pollMs = 1000,
  retryBaseDelayMs = 1000,
  retryMaxDelayMs = 60000
} = {}) {
  if (typeof workerId !== 'string' || workerId.trim() === '') throw new TypeError('workerId is required');
  for (const method of ['releaseDue', 'recoverAbandoned', 'claim', 'heartbeat', 'complete', 'fail']) {
    requiredFunction(queue?.[method], `queue.${method}`);
  }
  requiredFunction(actionGate, 'actionGate');
  requiredFunction(executor, 'executor');
  if (typeof environment !== 'string' || environment.trim() === '') throw new TypeError('environment is required');
  if (typeof revision !== 'string' || revision.trim() === '') throw new TypeError('revision is required');
  positiveInteger(leaseMs, 'leaseMs');
  positiveInteger(heartbeatMs, 'heartbeatMs');
  positiveInteger(pollMs, 'pollMs');
  positiveInteger(retryBaseDelayMs, 'retryBaseDelayMs');
  positiveInteger(retryMaxDelayMs, 'retryMaxDelayMs');
  if (heartbeatMs >= leaseMs) throw new TypeError('heartbeatMs must be less than leaseMs');

  let phase = 'created';
  let accepting = false;
  let timer = null;
  let activeTaskId = null;
  let cycles = 0;
  let completed = 0;
  let failed = 0;
  let lastError = null;

  function traceContextFor(task = null) {
    const supplied = task?.payload?.traceContext ?? {};
    const fallbackId = task?.task_id ?? `${workerId}:system`;
    return {
      traceId: supplied.traceId ?? fallbackId,
      requestId: supplied.requestId ?? fallbackId,
      parentSpanId: supplied.parentSpanId ?? null,
      environment: supplied.environment ?? environment,
      revision: supplied.revision ?? revision
    };
  }

  function event(workerEvent, task, outcome, data = {}) {
    const eventClass = EVENT_CLASS_MAP[workerEvent] ?? 'audit_event';
    observability.record({
      channel: workerEvent === 'worker_action_gate_decision' ? 'audit' : 'telemetry',
      eventClass,
      stage: 'durable-worker',
      outcome,
      traceContext: traceContextFor(task),
      actorRef: task?.global_user_id ?? null,
      scopeRef: { projectScope: task?.project_scope ?? null },
      data: { workerEvent, workerId, taskId: task?.task_id ?? null, attempt: task?.attempt ?? null, ...data }
    });
  }

  function recordFailure(task, stage, error, code) {
    observability.recordFailure?.({
      traceContext: traceContextFor(task),
      stage,
      reason: error.message,
      code,
      actorRef: task?.global_user_id ?? null,
      scopeRef: { projectScope: task?.project_scope ?? null },
      data: { workerId, taskId: task?.task_id ?? null }
    });
  }

  async function executeClaimed(task) {
    activeTaskId = task.task_id;
    event('worker_task_claimed', task, 'running');
    let heartbeatTimer = null;
    try {
      heartbeatTimer = setInterval(() => {
        queue.heartbeat({ taskId: task.task_id, workerId, leaseMs }).catch((error) => {
          lastError = error;
          recordFailure(task, 'durable-worker-heartbeat', error, error.code ?? 'heartbeat_failed');
        });
      }, heartbeatMs);

      const requiresActionGate = task.protected_action || task.kind === 'self-notification';
      if (requiresActionGate) {
        const gateDecision = await actionGate(Object.freeze({
          taskId: task.task_id,
          kind: task.kind,
          payload: task.payload,
          actorGlobalUserId: task.global_user_id,
          projectScope: task.project_scope,
          groupScope: task.group_scope ?? null,
          threadScope: task.thread_scope ?? null,
          identityContext: task.payload?.identityContext,
          scopeContext: task.payload?.scopeContext,
          traceContext: traceContextFor(task),
          automated: true,
          idempotencyKey: task.idempotency_key
        }));
        const allowed = gateDecision?.allowed === true || gateDecision?.outcome === 'allow';
        event('worker_action_gate_decision', task, allowed ? 'allow' : gateDecision?.outcome ?? 'deny', { gateOutcome: gateDecision?.outcome ?? null, gateReason: gateDecision?.reason ?? null, deferUntil: gateDecision?.deferUntil ?? null });
        if (!allowed) {
          const error = new Error(gateDecision?.reason ?? 'action_gate_denied');
          error.code = gateDecision?.outcome === 'defer' ? 'action_gate_deferred' : 'action_gate_denied';
          if (gateDecision?.outcome === 'defer' && gateDecision?.deferUntil) error.deferUntil = gateDecision.deferUntil;
          else error.retryable = false;
          throw error;
        }
      }

      const result = await executor(Object.freeze({
        taskId: task.task_id,
        kind: task.kind,
        payload: task.payload,
        attempt: task.attempt,
        idempotencyKey: task.idempotency_key,
        traceContext: traceContextFor(task),
        scope: {
          globalUserId: task.global_user_id,
          projectScope: task.project_scope,
          groupScope: task.group_scope,
          threadScope: task.thread_scope
        }
      }));
      const executionEvaluation = evaluateDurableExecutionResult(result);
      if (!executionEvaluation.accepted) throw createDurableExecutionOutcomeError(executionEvaluation);
      const finalTask = await queue.complete({ taskId: task.task_id, workerId, result });
      completed += 1;
      event('worker_task_completed', finalTask, executionEvaluation.outcome, { workflowOutcome: executionEvaluation.outcome, failureClass: executionEvaluation.failureClass });
      return finalTask;
    } catch (error) {
      failed += 1;
      lastError = error;
      const failure = await queue.fail({ taskId: task.task_id, workerId, error, baseDelayMs: retryBaseDelayMs, maxDelayMs: retryMaxDelayMs });
      const workerEvent = failure.outcome === 'dead_letter'
        ? 'worker_task_dead_lettered'
        : failure.outcome === 'deferred'
          ? 'worker_task_deferred'
          : 'worker_task_retry_scheduled';
      event(workerEvent, failure.task, failure.outcome, { error: error.message, delayMs: failure.delayMs ?? null, deferUntil: failure.deferUntil ?? null });
      return failure.task;
    } finally {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      activeTaskId = null;
    }
  }

  async function runOnce() {
    cycles += 1;
    await queue.releaseDue();
    const recovered = await queue.recoverAbandoned();
    for (const task of recovered) event('worker_task_recovered', task, task.status);
    const task = await queue.claim({ workerId, leaseMs });
    if (!task) return null;
    return executeClaimed(task);
  }

  async function loop() {
    if (!accepting) return;
    try {
      await runOnce();
    } catch (error) {
      lastError = error;
      recordFailure(null, 'durable-worker-loop', error, error.code ?? 'worker_loop_failed');
    } finally {
      if (accepting) timer = setTimeout(loop, pollMs);
    }
  }

  async function start() {
    if (phase !== 'created' && phase !== 'stopped') throw new Error(`worker cannot start from phase ${phase}`);
    phase = 'starting';
    accepting = true;
    phase = 'ready';
    timer = setTimeout(loop, 0);
    return health();
  }

  async function stop() {
    accepting = false;
    phase = 'stopping';
    if (timer) clearTimeout(timer);
    timer = null;
    while (activeTaskId) await new Promise((resolve) => setTimeout(resolve, 5));
    phase = 'stopped';
    return health();
  }

  function health() {
    return Object.freeze({
      ok: phase !== 'failed',
      phase,
      accepting,
      workerId,
      activeTaskId,
      cycles,
      completed,
      failed,
      lastError: lastError?.message ?? null
    });
  }

  return Object.freeze({ start, stop, runOnce, health });
}