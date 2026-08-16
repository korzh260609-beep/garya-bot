import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowUpdateCapability } from '../src/automation/index.js';

const scope = Object.freeze({
  globalUserId: 'user:aw2.9',
  projectScope: 'sg2.1',
  groupScope: null,
  threadScope: null
});
const actor = Object.freeze({ globalUserId: 'user:aw2.9', roles: ['owner'] });

function workflow({ automationId, trigger }) {
  return {
    schemaVersion: 1,
    automationId,
    version: 1,
    trigger,
    steps: [
      { type: 'compose', mode: 'static-message', input: 'message' },
      { type: 'deliver', mode: 'legacy-self-notification' }
    ],
    inputs: { message: 'before' },
    delivery: {
      originTarget: { transport: 'telegram', address: '123' },
      recipientGlobalUserId: 'user:aw2.9',
      projectScope: 'sg2.1',
      originBoundSelfNotification: true
    },
    executionPolicy: { maxAttempts: 3, confirmationRequired: false, protectedAction: true },
    scope,
    createdBy: 'user:aw2.9',
    updatedBy: 'user:aw2.9',
    createdAt: '2026-08-16T12:00:00.000Z',
    updatedAt: '2026-08-16T12:00:00.000Z',
    provenance: { source: 'aw2.9-regression' }
  };
}

function atomicStore(record) {
  const commits = [];
  return {
    atomicRuntimeMutation: true,
    commits,
    async resolve() {
      return [structuredClone(record)];
    },
    async commitMutation(input) {
      commits.push(input);
      const transaction = Object.freeze({
        marker: 'aw2.9-transaction',
        query: async () => ({ rows: [] })
      });
      const runtimeResult = await input.runtimeMutation(transaction);
      return {
        record: {
          ...structuredClone(record),
          workflow: structuredClone(input.nextWorkflow)
        },
        runtimeResult
      };
    }
  };
}

function authorization() {
  return {
    async authorize() {
      return { allowed: true, reason: 'aw2.9-test' };
    }
  };
}

test('AW2.9 recurring update patches the same automation/task/schedule and never creates or registers duplicates', async () => {
  const record = {
    workflow: workflow({
      automationId: 'automation:aw2.9:recurring',
      trigger: {
        type: 'recurring',
        recurrence: {
          rule: 'FREQ=DAILY',
          timeZone: 'Europe/Kyiv',
          dtstartLocal: '2026-08-17T07:00:00'
        }
      }
    }),
    taskId: 'task:aw2.9:recurring',
    scheduleId: 'schedule:aw2.9:recurring',
    lifecycleStatus: 'active'
  };
  const store = atomicStore(record);
  const forbidden = [];
  const queueCalls = [];
  const schedulerCalls = [];
  const queue = {
    async create(input) { forbidden.push(['queue.create', input]); throw new Error('duplicate task creation is forbidden'); },
    async register(input) { forbidden.push(['queue.register', input]); throw new Error('duplicate task registration is forbidden'); },
    async syncWorkflowTask(input) {
      queueCalls.push(input);
      return { task_id: input.taskId, status: 'scheduled' };
    }
  };
  const scheduler = {
    async create(input) { forbidden.push(['scheduler.create', input]); throw new Error('duplicate schedule creation is forbidden'); },
    async register(input) { forbidden.push(['scheduler.register', input]); throw new Error('duplicate schedule registration is forbidden'); },
    async update(input) {
      schedulerCalls.push(input);
      return { scheduleId: input.scheduleId, status: 'active' };
    }
  };
  const service = createWorkflowUpdateCapability({
    store,
    authorization: authorization(),
    recurringScheduler: scheduler,
    oneShotTaskQueue: queue,
    clock: () => new Date('2026-08-16T18:00:00.000Z')
  });

  const result = await service.update({
    selector: { automationId: record.workflow.automationId },
    scope,
    patch: {
      trigger: {
        type: 'recurring',
        recurrence: {
          rule: 'FREQ=HOURLY;INTERVAL=2',
          timeZone: 'Europe/Kyiv',
          dtstartLocal: '2026-08-17T08:00:00'
        }
      },
      inputs: { message: 'after' }
    },
    actor
  });

  assert.equal(forbidden.length, 0);
  assert.equal(result.automationId, record.workflow.automationId);
  assert.equal(result.previousVersion, 1);
  assert.equal(result.version, 2);
  assert.equal(result.workflow.automationId, record.workflow.automationId);
  assert.equal(result.workflow.version, 2);
  assert.equal(result.schedule.scheduleId, record.scheduleId);
  assert.equal(queueCalls.length, 1);
  assert.equal(queueCalls[0].taskId, record.taskId);
  assert.equal(queueCalls[0].workflow.automationId, record.workflow.automationId);
  assert.equal(queueCalls[0].workflow.version, 2);
  assert.equal(schedulerCalls.length, 1);
  assert.equal(schedulerCalls[0].scheduleId, record.scheduleId);
  assert.equal(schedulerCalls[0].state.automationId, record.workflow.automationId);
  assert.equal(schedulerCalls[0].state.workflowVersion, 2);
  assert.equal(store.commits[0].nextWorkflow.automationId, record.workflow.automationId);
  assert.equal(store.commits[0].nextWorkflow.version, 2);
});

test('AW2.9 one-shot update patches the same automation/task and never creates or registers a second task', async () => {
  const record = {
    workflow: workflow({
      automationId: 'automation:aw2.9:one-shot',
      trigger: { type: 'one-shot', runAt: '2026-08-17T10:00:00.000Z' }
    }),
    taskId: 'task:aw2.9:one-shot',
    scheduleId: null,
    lifecycleStatus: 'active'
  };
  const store = atomicStore(record);
  const forbidden = [];
  const calls = [];
  const queue = {
    async create(input) { forbidden.push(['queue.create', input]); throw new Error('duplicate task creation is forbidden'); },
    async register(input) { forbidden.push(['queue.register', input]); throw new Error('duplicate task registration is forbidden'); },
    async syncWorkflowTask(input) {
      calls.push(['syncWorkflowTask', input]);
      return { task_id: input.taskId, status: 'scheduled' };
    },
    async updateScheduled(input) {
      calls.push(['updateScheduled', input]);
      return { task_id: input.taskId, status: 'scheduled' };
    }
  };
  const service = createWorkflowUpdateCapability({
    store,
    authorization: authorization(),
    oneShotTaskQueue: queue,
    clock: () => new Date('2026-08-16T18:00:00.000Z')
  });

  const result = await service.update({
    selector: { taskId: record.taskId },
    scope,
    patch: {
      trigger: { type: 'one-shot', runAt: '2026-08-18T11:30:00.000Z' },
      inputs: { message: 'after' }
    },
    actor
  });

  assert.equal(forbidden.length, 0);
  assert.equal(result.automationId, record.workflow.automationId);
  assert.equal(result.previousVersion, 1);
  assert.equal(result.version, 2);
  assert.equal(result.workflow.automationId, record.workflow.automationId);
  assert.equal(result.workflow.version, 2);
  assert.equal(result.task.taskId, record.taskId);
  assert.equal(result.task.workflowVersion, 2);
  assert.equal(calls.filter(([name]) => name === 'updateScheduled').length, 1);
  assert.equal(calls.find(([name]) => name === 'updateScheduled')[1].taskId, record.taskId);
  assert.equal(calls.find(([name]) => name === 'updateScheduled')[1].automationId, record.workflow.automationId);
  assert.equal(store.commits[0].nextWorkflow.automationId, record.workflow.automationId);
  assert.equal(store.commits[0].nextWorkflow.version, 2);
});
