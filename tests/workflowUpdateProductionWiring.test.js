import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowUpdateCapability, createWorkflowRegisteredTaskStore } from '../src/automation/index.js';

const scope = Object.freeze({ globalUserId: 'user:prod', projectScope: 'sg2.1', groupScope: null, threadScope: null });
const actor = Object.freeze({ globalUserId: 'user:prod', roles: ['owner'] });

function recurringWorkflow(overrides = {}) {
  return {
    schemaVersion: 1,
    automationId: 'automation:prod',
    version: 1,
    trigger: { type: 'recurring', recurrence: { rule: 'FREQ=DAILY', timeZone: 'Europe/Kyiv', dtstartLocal: '2026-08-17T07:00:00' } },
    steps: [{ type: 'compose', mode: 'static-message', input: 'message' }, { type: 'deliver', mode: 'legacy-self-notification' }],
    inputs: { message: 'old' },
    delivery: { originTarget: { transport: 'telegram', address: '123' }, recipientGlobalUserId: 'user:prod', projectScope: 'sg2.1', originBoundSelfNotification: true },
    executionPolicy: { maxAttempts: 3, confirmationRequired: false, protectedAction: true },
    scope,
    createdBy: 'user:prod',
    updatedBy: 'user:prod',
    createdAt: '2026-08-16T12:00:00.000Z',
    updatedAt: '2026-08-16T12:00:00.000Z',
    provenance: { source: 'test' },
    ...overrides
  };
}

function oneShotWorkflow() {
  return recurringWorkflow({
    automationId: 'automation:one-shot',
    trigger: { type: 'one-shot', runAt: '2026-08-17T10:00:00.000Z' }
  });
}

function authorization() {
  return Object.freeze({ async authorize() { return Object.freeze({ allowed: true, reason: 'test-gate' }); } });
}

function atomicStore(record, { conflict = false } = {}) {
  const calls = [];
  return {
    atomicRuntimeMutation: true,
    calls,
    async resolve() { return [structuredClone(record)]; },
    async commitMutation(input) {
      calls.push(input);
      if (conflict) return null;
      const tx = Object.freeze({ query: async () => ({ rows: [] }), marker: 'same-db-transaction' });
      const runtimeResult = await input.runtimeMutation(tx);
      return {
        record: { ...structuredClone(record), workflow: structuredClone(input.nextWorkflow) },
        runtimeResult
      };
    }
  };
}

test('AW2.7 stale optimistic commit cannot mutate recurring scheduler', async () => {
  const record = { workflow: recurringWorkflow(), taskId: 'task:prod', scheduleId: 'schedule:prod', lifecycleStatus: 'active' };
  const store = atomicStore(record, { conflict: true });
  const schedulerCalls = [];
  const scheduler = {
    async update(input) { schedulerCalls.push(input); return { scheduleId: input.scheduleId, status: 'active' }; }
  };
  const service = createWorkflowUpdateCapability({ store, authorization: authorization(), recurringScheduler: scheduler });

  await assert.rejects(
    service.update({ selector: { automationId: 'automation:prod' }, scope, patch: { trigger: { type: 'recurring', recurrence: { rule: 'FREQ=HOURLY', timeZone: 'Europe/Kyiv', dtstartLocal: '2026-08-17T08:00:00' } } }, actor }),
    (error) => error.code === 'workflow_update_commit_conflict'
  );
  assert.equal(schedulerCalls.length, 0);
});

test('AW2.7 recurring scheduler and durable task sync receive the same transaction as workflow commit', async () => {
  const record = { workflow: recurringWorkflow(), taskId: 'task:prod', scheduleId: 'schedule:prod', lifecycleStatus: 'active' };
  const store = atomicStore(record);
  const seen = [];
  const scheduler = {
    async update(input) { seen.push(['scheduler', input.transaction]); return { scheduleId: input.scheduleId, status: 'active' }; }
  };
  const queue = {
    async syncWorkflowTask(input) { seen.push(['task', input.transaction]); return { task_id: input.taskId, status: 'scheduled' }; }
  };
  const service = createWorkflowUpdateCapability({ store, authorization: authorization(), recurringScheduler: scheduler, oneShotTaskQueue: queue });
  const result = await service.update({
    selector: { automationId: 'automation:prod' },
    scope,
    patch: {
      trigger: { type: 'recurring', recurrence: { rule: 'FREQ=HOURLY;INTERVAL=2', timeZone: 'Europe/Kyiv', dtstartLocal: '2026-08-17T08:00:00' } },
      inputs: { message: 'new' }
    },
    actor
  });

  assert.equal(result.version, 2);
  assert.equal(seen.length, 2);
  assert.equal(seen[0][1], seen[1][1]);
  assert.equal(seen[0][1].marker, 'same-db-transaction');
  assert.equal(result.schedule.scheduleId, 'schedule:prod');
});

test('AW2.7 one-shot trigger update reuses the existing durable queue and increments workflow version', async () => {
  const record = { workflow: oneShotWorkflow(), taskId: 'task:one-shot', scheduleId: null, lifecycleStatus: 'active' };
  const store = atomicStore(record);
  const calls = [];
  const queue = {
    async syncWorkflowTask(input) { calls.push(['sync', input]); return { task_id: input.taskId, status: 'scheduled' }; },
    async updateScheduled(input) { calls.push(['update', input]); return { task_id: input.taskId, status: 'scheduled' }; }
  };
  const service = createWorkflowUpdateCapability({ store, authorization: authorization(), oneShotTaskQueue: queue });
  const result = await service.update({
    selector: { taskId: 'task:one-shot' },
    scope,
    patch: { trigger: { type: 'one-shot', runAt: '2026-08-18T11:30:00.000Z' }, inputs: { message: 'updated one-shot' } },
    actor
  });

  assert.equal(result.version, 2);
  assert.equal(result.workflow.trigger.runAt, '2026-08-18T11:30:00.000Z');
  assert.equal(calls.filter(([name]) => name === 'update').length, 1);
  const update = calls.find(([name]) => name === 'update')[1];
  assert.equal(update.taskId, 'task:one-shot');
  assert.equal(update.workflowVersion, 2);
  assert.equal(update.transaction.marker, 'same-db-transaction');
  assert.equal(result.task.workflowVersion, 2);
});

test('AW2.7 content-only update synchronizes the existing durable task/template without scheduler mutation', async () => {
  const record = { workflow: recurringWorkflow(), taskId: 'task:prod', scheduleId: 'schedule:prod', lifecycleStatus: 'active' };
  const store = atomicStore(record);
  const queueCalls = [];
  const schedulerCalls = [];
  const queue = {
    async syncWorkflowTask(input) { queueCalls.push(input); return { task_id: input.taskId, status: 'scheduled' }; }
  };
  const scheduler = { async update(input) { schedulerCalls.push(input); return { status: 'active' }; } };
  const service = createWorkflowUpdateCapability({ store, authorization: authorization(), recurringScheduler: scheduler, oneShotTaskQueue: queue });
  const result = await service.update({ selector: { automationId: 'automation:prod' }, scope, patch: { inputs: { message: 'new content' } }, actor });

  assert.equal(result.version, 2);
  assert.equal(queueCalls.length, 1);
  assert.equal(queueCalls[0].workflow.inputs.message, 'new content');
  assert.equal(queueCalls[0].workflow.version, 2);
  assert.equal(queueCalls[0].allowTerminal, true);
  assert.equal(schedulerCalls.length, 0);
});

test('production task registration persists one-shot workflow v1 using Date timestamps', async () => {
  const registered = [];
  const taskStore = {
    async create() {
      return {
        taskId: 'task:registered',
        status: 'scheduled',
        availableAt: new Date('2026-08-17T10:00:00.000Z'),
        createdAt: new Date('2026-08-16T12:00:00.000Z'),
        updatedAt: new Date('2026-08-16T12:00:00.000Z')
      };
    },
    async list() { return []; },
    async get() { return null; },
    async cancel() { return null; }
  };
  const workflowStore = { async register(input) { registered.push(input); return input; } };
  const store = createWorkflowRegisteredTaskStore({ taskStore, workflowStore });
  await store.create({
    scope: { userScope: 'user:prod', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    input: {
      kind: 'self-notification',
      maxAttempts: 3,
      protectedAction: true,
      approvalRequired: false,
      payload: {
        message: 'hello',
        delivery: { originTarget: { transport: 'telegram', address: '123' }, recipientGlobalUserId: 'user:prod', projectScope: 'sg2.1', originBoundSelfNotification: true },
        automation: { source: 'canonical-user-request', capability: 'task-create' }
      }
    }
  });

  assert.equal(registered.length, 1);
  assert.equal(registered[0].workflow.version, 1);
  assert.equal(registered[0].workflow.automationId, 'task:registered');
  assert.equal(registered[0].workflow.trigger.type, 'one-shot');
  assert.equal(registered[0].workflow.trigger.runAt, '2026-08-17T10:00:00.000Z');
  assert.equal(registered[0].taskId, 'task:registered');
  assert.equal(registered[0].scheduleId, null);
});
