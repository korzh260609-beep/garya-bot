import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutomationEngine } from '../src/automation/index.js';

function fixture(overrides = {}) {
  let now = new Date('2026-01-01T00:00:00.000Z');
  const executed = [];
  const gates = [];
  const engine = createAutomationEngine({
    clock: () => now,
    idFactory: (() => { let id = 0; return () => `task-${++id}`; })(),
    actionGate: async (request) => { gates.push(request); return { allowed: true, reason: 'allowed' }; },
    executor: async (task) => { executed.push(task); return { ok: true, kind: task.kind }; },
    ...overrides
  });
  return { engine, executed, gates, advance(ms) { now = new Date(now.getTime() + ms); } };
}

const base = {
  kind: 'report.generate',
  payload: { report: 'daily' },
  identityContext: { globalUserId: 'global:monarch', roles: ['monarch'] },
  scopeContext: { projectScope: 'sg2.1' },
  traceContext: { traceId: 'trace-1', requestId: 'request-1' }
};

test('queued task executes and completes', async () => {
  const f = fixture();
  const task = f.engine.submit(base);
  assert.equal(task.status, 'queued');
  const result = await f.engine.runNext();
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.result, { ok: true, kind: 'report.generate' });
  assert.equal(f.executed.length, 1);
});

test('scheduled task is released only when due', async () => {
  const f = fixture();
  const task = f.engine.submit({ ...base, runAt: '2026-01-01T01:00:00.000Z' });
  assert.equal(task.status, 'scheduled');
  assert.equal(await f.engine.runNext(), null);
  f.advance(60 * 60 * 1000);
  assert.equal((await f.engine.runNext()).status, 'completed');
});

test('confirmation flow requires approval before execution', async () => {
  const f = fixture();
  const task = f.engine.submit({ ...base, confirmationRequired: true });
  assert.equal(task.status, 'waiting_approval');
  assert.equal(await f.engine.runNext(), null);
  f.engine.approve(task.id);
  assert.equal((await f.engine.runNext()).status, 'completed');
});

test('protected automated actions always pass Action Gate', async () => {
  const f = fixture();
  f.engine.submit({ ...base, protectedAction: true });
  await f.engine.runNext();
  assert.equal(f.gates.length, 1);
  assert.equal(f.gates[0].automated, true);
  assert.equal(f.gates[0].identityContext.globalUserId, 'global:monarch');
});

test('Action Gate denial blocks execution', async () => {
  const f = fixture({ actionGate: async () => ({ allowed: false, reason: 'permission_denied' }) });
  f.engine.submit({ ...base, protectedAction: true });
  const result = await f.engine.runNext();
  assert.equal(result.status, 'failed');
  assert.equal(result.lastError, 'permission_denied');
  assert.equal(f.executed.length, 0);
});

test('failed work retries then moves to DLQ', async () => {
  const f = fixture({ executor: async () => { throw new Error('temporary failure'); } });
  f.engine.submit({ ...base, maxAttempts: 2 });
  assert.equal((await f.engine.runNext()).status, 'queued');
  assert.equal((await f.engine.runNext()).status, 'dead_letter');
  assert.equal(f.engine.listDeadLetters().length, 1);
  assert.match(f.engine.listDeadLetters()[0].lastError, /temporary failure/);
});

test('cancellation prevents queued execution', async () => {
  const f = fixture();
  const task = f.engine.submit(base);
  f.engine.cancel(task.id, 'monarch_cancelled');
  assert.equal(await f.engine.runNext(), null);
  assert.equal(f.engine.get(task.id).status, 'cancelled');
});

test('delegated agents are replaceable components, not identities', async () => {
  const f = fixture();
  const agent = f.engine.registerAgent({ id: 'agent-report', name: 'Report Agent', capabilities: ['report.generate'] });
  assert.equal(agent.identityMode, 'delegated-component');
  assert.equal(agent.replaceable, true);
  const task = f.engine.delegate(agent.id, base);
  assert.equal(task.identityContext.globalUserId, 'global:monarch');
  assert.equal(task.payload.delegatedAgentId, agent.id);
});

test('events make delayed and failed work observable', async () => {
  const f = fixture({ executor: async () => { throw new Error('boom'); } });
  f.engine.submit({ ...base, maxAttempts: 1 });
  await f.engine.runNext();
  const types = f.engine.listEvents().map((event) => event.type);
  assert.deepEqual(types, ['task.submitted', 'task.started', 'task.dead_lettered']);
});
