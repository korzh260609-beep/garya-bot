import { randomUUID } from 'node:crypto';
import { createAutomationEvent, createAutomationTask, createDelegatedAgent } from './contracts.js';

function requiredFunction(value, field) {
  if (typeof value !== 'function') throw new TypeError(`${field} must be a function`);
  return value;
}

function cloneTask(task, patch, now) {
  return createAutomationTask({ ...task, ...patch, updatedAt: now });
}

export function createAutomationEngine({
  actionGate,
  executor,
  clock = () => new Date(),
  idFactory = randomUUID,
  retryDelayMs = 0,
  onEvent = () => {}
} = {}) {
  requiredFunction(actionGate, 'actionGate');
  requiredFunction(executor, 'executor');
  requiredFunction(clock, 'clock');
  requiredFunction(idFactory, 'idFactory');
  requiredFunction(onEvent, 'onEvent');
  if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) throw new TypeError('retryDelayMs must be non-negative');

  const tasks = new Map();
  const agents = new Map();
  const queue = [];
  const deadLetters = [];
  const events = [];

  function now() { return clock().toISOString(); }
  function emit(type, task, details = null) {
    const event = createAutomationEvent(type, task, details, now());
    events.push(event);
    onEvent(event);
  }
  function save(task) { tasks.set(task.id, task); return task; }
  function get(id) {
    const task = tasks.get(id);
    if (!task) throw new Error(`task not found: ${id}`);
    return task;
  }

  function submit(input) {
    const at = now();
    const runAt = input.runAt == null ? null : new Date(input.runAt).toISOString();
    let status = runAt && new Date(runAt) > clock() ? 'scheduled' : 'queued';
    if (input.confirmationRequired === true) status = 'waiting_approval';
    const task = createAutomationTask({ ...input, id: input.id ?? idFactory(), status, runAt, attempt: 0, createdAt: at, updatedAt: at });
    save(task);
    if (status === 'queued') queue.push(task.id);
    emit('task.submitted', task);
    return task;
  }

  function releaseDue() {
    const current = clock();
    const released = [];
    for (const task of tasks.values()) {
      if (task.status === 'scheduled' && new Date(task.runAt) <= current) {
        const queued = save(cloneTask(task, { status: 'queued' }, now()));
        queue.push(queued.id);
        emit('task.queued', queued, { reason: 'schedule_due' });
        released.push(queued);
      }
    }
    return Object.freeze(released);
  }

  function approve(id) {
    const task = get(id);
    if (task.status !== 'waiting_approval') throw new Error(`task is not waiting approval: ${id}`);
    const queued = save(cloneTask(task, { status: 'queued', confirmationRequired: false }, now()));
    queue.push(id);
    emit('task.approved', queued);
    return queued;
  }

  function cancel(id, reason = 'cancelled') {
    const task = get(id);
    if (['completed', 'cancelled', 'dead_letter'].includes(task.status)) return task;
    const cancelled = save(cloneTask(task, { status: 'cancelled', lastError: reason }, now()));
    emit('task.cancelled', cancelled, { reason });
    return cancelled;
  }

  async function runNext() {
    releaseDue();
    let id;
    while ((id = queue.shift())) {
      const current = get(id);
      if (current.status !== 'queued') continue;
      const running = save(cloneTask(current, { status: 'running', attempt: current.attempt + 1 }, now()));
      emit('task.started', running);
      try {
        if (running.protectedAction) {
          const decision = await actionGate(Object.freeze({
            taskId: running.id,
            kind: running.kind,
            payload: running.payload,
            identityContext: running.identityContext,
            scopeContext: running.scopeContext,
            traceContext: running.traceContext,
            automated: true
          }));
          if (!decision || decision.allowed !== true) {
            const blocked = save(cloneTask(running, { status: 'failed', lastError: decision?.reason ?? 'action_gate_denied' }, now()));
            emit('task.blocked', blocked, decision ?? null);
            return blocked;
          }
        }
        const result = await executor(running);
        const completed = save(cloneTask(running, { status: 'completed', result: result ?? null, lastError: null }, now()));
        emit('task.completed', completed);
        return completed;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (running.attempt < running.maxAttempts) {
          const retry = save(cloneTask(running, { status: 'queued', lastError: message }, now()));
          if (retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          queue.push(retry.id);
          emit('task.retry_scheduled', retry, { error: message, nextAttempt: retry.attempt + 1 });
          return retry;
        }
        const dead = save(cloneTask(running, { status: 'dead_letter', lastError: message }, now()));
        deadLetters.push(dead.id);
        emit('task.dead_lettered', dead, { error: message });
        return dead;
      }
    }
    return null;
  }

  function registerAgent(input) {
    const agent = createDelegatedAgent(input);
    if (agents.has(agent.id)) throw new Error(`agent already registered: ${agent.id}`);
    agents.set(agent.id, agent);
    return agent;
  }

  function delegate(agentId, input) {
    const agent = agents.get(agentId);
    if (!agent) throw new Error(`agent not registered: ${agentId}`);
    if (!agent.capabilities.includes(input.kind)) throw new Error(`agent cannot perform: ${input.kind}`);
    return submit({ ...input, payload: { ...input.payload, delegatedAgentId: agent.id } });
  }

  return Object.freeze({
    submit, releaseDue, approve, cancel, runNext, registerAgent, delegate,
    get,
    list: () => Object.freeze([...tasks.values()]),
    listDeadLetters: () => Object.freeze(deadLetters.map(get)),
    listEvents: () => Object.freeze([...events]),
    queueSize: () => queue.length
  });
}
