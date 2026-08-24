import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKFLOW_MUTATION_FIELDS,
  WORKFLOW_LIFECYCLE_ACTIONS,
  WorkflowUpdateError,
  createWorkflowUpdateCapability
} from '../src/automation/index.js';

function workflow(overrides = {}) {
  return {
    schemaVersion: 1,
    automationId: 'automation:aw2.7:test',
    version: 1,
    trigger: {
      type: 'recurring',
      recurrence: { rule: 'FREQ=DAILY', timeZone: 'Europe/Kyiv', dtstartLocal: '2026-08-17T07:00:00' }
    },
    steps: [
      { type: 'compose', mode: 'static-message', input: 'message' },
      { type: 'deliver', mode: 'legacy-self-notification' }
    ],
    inputs: { message: 'hello' },
    delivery: { transport: 'telegram', target: 'self' },
    executionPolicy: { maxAttempts: 3, confirmationRequired: false },
    scope: { globalUserId: 'user:test', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    createdBy: 'user:test',
    updatedBy: 'user:test',
    createdAt: '2026-08-16T12:00:00.000Z',
    updatedAt: '2026-08-16T12:00:00.000Z',
    provenance: { source: 'test' },
    ...overrides
  };
}

function memoryStore(records = [{
  workflow: workflow(),
  scheduleId: 'schedule:test',
  taskId: 'task:test',
  lifecycleStatus: 'active'
}]) {
  const current = records.map((record) => structuredClone(record));
  const history = [];
  return {
    current,
    historyRecords: history,
    async resolve({ selector }) {
      return current.filter((record) => (
        (selector.automationId == null || record.workflow.automationId === selector.automationId)
        && (selector.taskId == null || record.taskId === selector.taskId)
        && (selector.scheduleId == null || record.scheduleId === selector.scheduleId)
      )).map((record) => structuredClone(record));
    },
    async commitMutation(input) {
      const index = current.findIndex((record) => record.workflow.automationId === input.currentWorkflow.automationId);
      if (index < 0 || current[index].workflow.version !== input.expectedVersion) return null;
      current[index] = {
        ...current[index],
        workflow: structuredClone(input.nextWorkflow),
        lifecycleStatus: input.lifecycleAction === 'pause'
          ? 'paused'
          : input.lifecycleAction === 'resume'
            ? 'active'
            : input.lifecycleAction === 'cancel'
              ? 'cancelled'
              : current[index].lifecycleStatus
      };
      history.push(structuredClone(input));
      return structuredClone(current[index]);
    },
    async history() {
      return history.map((record) => structuredClone(record));
    }
  };
}

function authorization({ allowed = true } = {}) {
  const calls = [];
  return {
    calls,
    async authorize(request) {
      calls.push(structuredClone(request));
      return { allowed, reason: allowed ? 'gate-allowed' : 'gate-denied', evidenceRefs: ['gate:test'] };
    }
  };
}

function scheduler() {
  const calls = [];
  return {
    calls,
    async update(request) {
      calls.push(['update', structuredClone(request)]);
      return { scheduleId: request.scheduleId, status: 'active' };
    },
    async pause(request) {
      calls.push(['pause', structuredClone(request)]);
      return { scheduleId: request.scheduleId, status: 'paused' };
    },
    async resume(request) {
      calls.push(['resume', structuredClone(request)]);
      return { scheduleId: request.scheduleId, status: 'active' };
    },
    async cancel(request) {
      calls.push(['cancel', structuredClone(request)]);
      return { scheduleId: request.scheduleId, status: 'cancelled' };
    }
  };
}

function capability({ store = memoryStore(), auth = authorization(), recurringScheduler = scheduler() } = {}) {
  return {
    store,
    auth,
    recurringScheduler,
    service: createWorkflowUpdateCapability({
      store,
      authorization: auth,
      recurringScheduler,
      clock: () => new Date('2026-08-16T15:00:00.000Z')
    })
  };
}

const scope = { globalUserId: 'user:test', projectScope: 'sg2.1', groupScope: null, threadScope: null };
const actor = { globalUserId: 'user:test', roles: ['owner'] };

test('AW2.7 exposes bounded mutation and lifecycle contracts', () => {
  assert.deepEqual(WORKFLOW_MUTATION_FIELDS, ['trigger', 'steps', 'inputs', 'delivery', 'executionPolicy']);
  assert.deepEqual(WORKFLOW_LIFECYCLE_ACTIONS, ['pause', 'resume', 'cancel']);
  assert.equal(Object.isFrozen(WORKFLOW_MUTATION_FIELDS), true);
  assert.equal(Object.isFrozen(WORKFLOW_LIFECYCLE_ACTIONS), true);
});

test('AW2.7 patches the same automation and increments version monotonically', async () => {
  const { service, store, auth } = capability();
  const result = await service.update({
    selector: { automationId: 'automation:aw2.7:test' },
    scope,
    patch: { inputs: { message: 'hello + report' } },
    expectedVersion: 1,
    actor,
    provenance: { requestId: 'request:1', traceId: 'trace:1' }
  });

  assert.equal(result.automationId, 'automation:aw2.7:test');
  assert.equal(result.previousVersion, 1);
  assert.equal(result.version, 2);
  assert.equal(result.workflow.inputs.message, 'hello + report');
  assert.equal(result.workflow.createdAt, '2026-08-16T12:00:00.000Z');
  assert.equal(result.workflow.updatedAt, '2026-08-16T15:00:00.000Z');
  assert.equal(store.current[0].workflow.version, 2);
  assert.equal(auth.calls.length, 1);
  assert.equal(auth.calls[0].action, 'automation.update');
});

test('AW2.7 never permits mutation of stable identity or scope', async () => {
  const { service } = capability();
  await assert.rejects(
    service.update({
      selector: { automationId: 'automation:aw2.7:test' },
      scope,
      patch: { automationId: 'other' },
      actor
    }),
    (error) => error instanceof WorkflowUpdateError && error.code === 'workflow_update_patch_field_forbidden'
  );
  await assert.rejects(
    service.update({
      selector: { automationId: 'automation:aw2.7:test' },
      scope,
      patch: { scope: { globalUserId: 'other', projectScope: 'other' } },
      actor
    }),
    (error) => error instanceof WorkflowUpdateError && error.code === 'workflow_update_patch_field_forbidden'
  );
});

test('AW2.7 fails closed on zero or multiple workflow matches', async () => {
  const none = capability({ store: memoryStore([]) }).service;
  await assert.rejects(
    none.update({ selector: { automationId: 'missing' }, scope, patch: { inputs: { message: 'x' } }, actor }),
    (error) => error.code === 'workflow_update_target_not_found'
  );

  const duplicate = workflow({ automationId: 'automation:duplicate' });
  const many = capability({
    store: memoryStore([
      { workflow: duplicate, taskId: 'task:1', scheduleId: 'schedule:1', lifecycleStatus: 'active' },
      { workflow: duplicate, taskId: 'task:2', scheduleId: 'schedule:2', lifecycleStatus: 'active' }
    ])
  }).service;
  await assert.rejects(
    many.update({ selector: { automationId: 'automation:duplicate' }, scope, patch: { inputs: { message: 'x' } }, actor }),
    (error) => error.code === 'workflow_update_target_ambiguous'
  );
});

test('AW2.7 authorization denial occurs before scheduler or persistence mutation', async () => {
  const store = memoryStore();
  const auth = authorization({ allowed: false });
  const recurringScheduler = scheduler();
  const { service } = capability({ store, auth, recurringScheduler });

  await assert.rejects(
    service.update({
      selector: { automationId: 'automation:aw2.7:test' },
      scope,
      patch: { trigger: workflow().trigger },
      actor
    }),
    (error) => error.code === 'workflow_update_authorization_denied'
  );

  assert.equal(recurringScheduler.calls.length, 0);
  assert.equal(store.historyRecords.length, 0);
  assert.equal(store.current[0].workflow.version, 1);
});

test('AW2.7 validates the complete next workflow before scheduler mutation', async () => {
  const { service, recurringScheduler, store } = capability();
  await assert.rejects(
    service.update({
      selector: { automationId: 'automation:aw2.7:test' },
      scope,
      patch: { steps: [] },
      actor
    }),
    /workflow\.steps must be a non-empty array/
  );
  assert.equal(recurringScheduler.calls.length, 0);
  assert.equal(store.historyRecords.length, 0);
});

test('AW2.7 rejects stale expectedVersion without any state change', async () => {
  const { service, recurringScheduler, store, auth } = capability();
  await assert.rejects(
    service.update({
      selector: { automationId: 'automation:aw2.7:test' },
      scope,
      patch: { inputs: { message: 'stale' } },
      expectedVersion: 9,
      actor
    }),
    (error) => error.code === 'workflow_update_version_conflict'
  );
  assert.equal(auth.calls.length, 0);
  assert.equal(recurringScheduler.calls.length, 0);
  assert.equal(store.current[0].workflow.version, 1);
});

test('AW2.7 delegates recurring schedule changes to the existing scheduler', async () => {
  const { service, recurringScheduler } = capability();
  const trigger = {
    type: 'recurring',
    recurrence: { rule: 'FREQ=HOURLY;INTERVAL=2', timeZone: 'Europe/Kyiv', dtstartLocal: '2026-08-17T08:30:00' }
  };
  const result = await service.update({
    selector: { scheduleId: 'schedule:test' },
    scope,
    patch: { trigger },
    actor
  });

  assert.equal(result.version, 2);
  assert.equal(recurringScheduler.calls.length, 1);
  assert.equal(recurringScheduler.calls[0][0], 'update');
  assert.equal(recurringScheduler.calls[0][1].scheduleId, 'schedule:test');
  assert.equal(recurringScheduler.calls[0][1].recurrence, 'FREQ=HOURLY;INTERVAL=2');
  assert.equal(recurringScheduler.calls[0][1].timeZone, 'Europe/Kyiv');
  assert.equal(recurringScheduler.calls[0][1].dtstartLocal, '2026-08-17T08:30:00');
});

test('AW2.7 pause resume and cancel reuse scheduler lifecycle operations and create versions', async () => {
  for (const action of ['pause', 'resume', 'cancel']) {
    const { service, recurringScheduler, store } = capability();
    const result = await service.update({
      selector: { automationId: 'automation:aw2.7:test' },
      scope,
      lifecycleAction: action,
      actor,
      provenance: { requestId: `request:${action}` }
    });
    assert.equal(result.version, 2);
    assert.equal(result.lifecycleAction, action);
    assert.equal(recurringScheduler.calls[0][0], action);
    assert.equal(store.historyRecords[0].patchSummary.lifecycleAction, action);
    assert.equal(store.historyRecords[0].gateResult.allowed, true);
  }
});

test('AW2.7 mutation history captures actor provenance gate result and delta summary', async () => {
  const { service, store } = capability();
  await service.update({
    selector: { taskId: 'task:test' },
    scope,
    patch: {
      delivery: { transport: 'telegram', target: 'self', format: 'markdown' },
      executionPolicy: { maxAttempts: 5, confirmationRequired: false }
    },
    actor,
    provenance: { requestId: 'request:history', traceId: 'trace:history' }
  });

  const [entry] = store.historyRecords;
  assert.equal(entry.currentWorkflow.version, 1);
  assert.equal(entry.nextWorkflow.version, 2);
  assert.equal(entry.actor.globalUserId, 'user:test');
  assert.equal(entry.provenance.requestId, 'request:history');
  assert.equal(entry.gateResult.allowed, true);
  assert.deepEqual(entry.patchSummary.fields, ['delivery', 'executionPolicy']);
});

test('AW2.7 requires an existing scheduler for trigger/lifecycle changes but not content-only patches', async () => {
  const noScheduler = capability({ recurringScheduler: null });
  const contentResult = await noScheduler.service.update({
    selector: { automationId: 'automation:aw2.7:test' },
    scope,
    patch: { inputs: { message: 'content-only' } },
    actor
  });
  assert.equal(contentResult.version, 2);

  const fresh = capability({ recurringScheduler: null });
  await assert.rejects(
    fresh.service.update({
      selector: { automationId: 'automation:aw2.7:test' },
      scope,
      lifecycleAction: 'pause',
      actor
    }),
    (error) => error.code === 'workflow_update_scheduler_unavailable'
  );
});
