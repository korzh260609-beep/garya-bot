import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresProductionTaskStore } from '../src/capability/postgresProductionTaskStore.js';

const scope = Object.freeze({ userScope: 'user-1', projectScope: 'sg2.1', groupScope: null, threadScope: null });

function row(overrides = {}) {
  return {
    task_id: 'task-1', global_user_id: 'user-1', project_scope: 'sg2.1', group_scope: null, thread_scope: null,
    status: 'queued', kind: 'user-task', payload: { title: 'test' }, result: null, last_error: null,
    attempt: 0, max_attempts: 3, available_at: '2026-08-06T00:00:00.000Z', created_at: '2026-08-06T00:00:00.000Z', updated_at: '2026-08-06T00:00:00.000Z',
    ...overrides
  };
}

test('durable production task store submits through the Block 13 queue', async () => {
  const calls = [];
  const taskQueue = {
    async submit(input) { calls.push(input); return row({ task_id: input.taskId }); },
    async cancel() { throw new Error('not used'); }
  };
  const database = { async query() { return { rows: [] }; } };
  const store = createPostgresProductionTaskStore({ database, taskQueue });
  const task = await store.create({ scope, input: { taskId: 'task-1', kind: 'report', payload: { x: 1 }, protectedAction: true } });
  assert.equal(task.taskId, 'task-1');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].scope, { globalUserId: 'user-1', projectScope: 'sg2.1', groupScope: null, threadScope: null });
  assert.equal(calls[0].protectedAction, true);
});

test('durable task reads are constrained by user/project/group/thread scope', async () => {
  const queries = [];
  const database = {
    async query(sql, values) { queries.push({ sql, values }); return { rows: [row()] }; }
  };
  const store = createPostgresProductionTaskStore({ database, taskQueue: { submit() {}, cancel() {} } });
  const task = await store.get({ scope, taskId: 'task-1' });
  assert.equal(task.taskId, 'task-1');
  assert.match(queries[0].sql, /global_user_id=\$2/);
  assert.match(queries[0].sql, /project_scope=\$3/);
  assert.deepEqual(queries[0].values, ['task-1', 'user-1', 'sg2.1', null, null]);
});

test('cancellation checks scope before calling durable queue', async () => {
  let cancelled = false;
  const database = { async query() { return { rows: [] }; } };
  const taskQueue = { submit() {}, async cancel() { cancelled = true; } };
  const store = createPostgresProductionTaskStore({ database, taskQueue });
  const result = await store.cancel({ scope, taskId: 'missing' });
  assert.equal(result, null);
  assert.equal(cancelled, false);
});
