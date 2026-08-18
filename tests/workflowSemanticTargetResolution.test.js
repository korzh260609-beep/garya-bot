import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowUpdateCapability } from '../src/automation/index.js';

const scope = Object.freeze({ globalUserId: 'user:test', projectScope: 'sg2.1', groupScope: null, threadScope: null });
const otherScope = Object.freeze({ globalUserId: 'user:other', projectScope: 'sg2.1', groupScope: null, threadScope: null });
const actor = Object.freeze({ globalUserId: 'user:test', roles: ['owner'] });

function workflow({ automationId, message, recurrence = 'FREQ=DAILY', localTime = '07:00', workflowScope = scope } = {}) {
  return {
    schemaVersion: 1,
    automationId,
    version: 1,
    trigger: {
      type: 'recurring',
      recurrence: { rule: recurrence, timeZone: 'Europe/Kyiv', dtstartLocal: `2026-08-17T${localTime}:00` }
    },
    steps: [
      { type: 'compose', mode: 'static-message', input: 'message' },
      { type: 'deliver', mode: 'legacy-self-notification' }
    ],
    inputs: { message },
    delivery: { transport: 'telegram', target: 'self' },
    executionPolicy: { maxAttempts: 3, confirmationRequired: false },
    scope: workflowScope,
    createdBy: workflowScope.globalUserId,
    updatedBy: workflowScope.globalUserId,
    createdAt: '2026-08-16T12:00:00.000Z',
    updatedAt: '2026-08-16T12:00:00.000Z',
    provenance: { source: 'test' }
  };
}

function sameScope(left, right) {
  return left.globalUserId === (right.globalUserId ?? right.userScope)
    && left.projectScope === right.projectScope
    && left.groupScope === (right.groupScope ?? null)
    && left.threadScope === (right.threadScope ?? null);
}

function memoryStore(records) {
  const current = records.map((record) => structuredClone(record));
  return {
    current,
    async resolve({ selector, scope: requestedScope }) {
      return current.filter((record) => sameScope(record.workflow.scope, requestedScope)
        && (selector.automationId == null || record.workflow.automationId === selector.automationId)
        && (selector.taskId == null || record.taskId === selector.taskId)
        && (selector.scheduleId == null || record.scheduleId === selector.scheduleId))
        .map((record) => structuredClone(record));
    },
    async list({ scope: requestedScope, limit = 100 }) {
      return current.filter((record) => sameScope(record.workflow.scope, requestedScope))
        .slice(0, limit)
        .map((record) => structuredClone(record));
    },
    async commitMutation(input) {
      const index = current.findIndex((record) => record.workflow.automationId === input.currentWorkflow.automationId);
      if (index < 0 || current[index].workflow.version !== input.expectedVersion) return null;
      current[index] = { ...current[index], workflow: structuredClone(input.nextWorkflow) };
      return structuredClone(current[index]);
    },
    async history() { return []; }
  };
}

function authorization() {
  const calls = [];
  return {
    calls,
    async authorize(request) {
      calls.push(structuredClone(request));
      return { allowed: true, reason: 'gate-allowed', evidenceRefs: ['gate:test'] };
    }
  };
}

function capability(records, recurringScheduler = null) {
  const store = memoryStore(records);
  const auth = authorization();
  const service = createWorkflowUpdateCapability({
    store,
    authorization: auth,
    recurringScheduler,
    clock: () => new Date('2026-08-16T15:00:00.000Z')
  });
  return { service, store, auth };
}

function record({ automationId, taskId, scheduleId, message, recurrence, localTime, workflowScope = scope, lifecycleStatus = 'active' }) {
  return {
    workflow: workflow({ automationId, message, recurrence, localTime, workflowScope }),
    taskId,
    scheduleId,
    lifecycleStatus
  };
}

test('AW2.8 resolves one existing automation from structured semantic target attributes and patches the same automationId', async () => {
  const { service, store, auth } = capability([
    record({ automationId: 'automation:morning', taskId: 'task:1', scheduleId: 'schedule:1', message: 'Morning report', localTime: '07:00' }),
    record({ automationId: 'automation:evening', taskId: 'task:2', scheduleId: 'schedule:2', message: 'Evening report', localTime: '19:00' })
  ]);

  const result = await service.update({
    selector: { triggerType: 'recurring', recurrence: 'RRULE:FREQ=DAILY', localTime: '7:00', notificationMessage: '  MORNING   report  ' },
    scope,
    patch: { inputs: { message: 'Morning report + activity' } },
    actor
  });

  assert.equal(result.automationId, 'automation:morning');
  assert.equal(result.version, 2);
  assert.equal(store.current[0].workflow.inputs.message, 'Morning report + activity');
  assert.equal(store.current[1].workflow.version, 1);
  assert.equal(auth.calls.length, 1);
  assert.deepEqual(auth.calls[0].selector, { automationId: 'automation:morning' });
  assert.equal(auth.calls[0].requestedSelector.localTime, '07:00');
  assert.equal(auth.calls[0].requestedSelector.recurrence, 'FREQ=DAILY');
});

test('numbered workflow selection follows the same visible recurring schedule order and never guesses by internal id order', async () => {
  const records = [
    record({ automationId: 'automation:a', taskId: 'task:1', scheduleId: 'schedule:1', message: 'Same', localTime: '07:00' }),
    record({ automationId: 'automation:b', taskId: 'task:2', scheduleId: 'schedule:2', message: 'Same', localTime: '07:00' })
  ];
  const recurringScheduler = {
    async list() { return [{ scheduleId: 'schedule:2' }, { scheduleId: 'schedule:1' }]; }
  };
  const { service, store } = capability(records, recurringScheduler);
  const result = await service.update({
    selector: { localTime: '07:00', notificationMessage: 'Same', position: 1 },
    scope,
    patch: { inputs: { message: 'Changed first visible automation' } },
    actor
  });
  assert.equal(result.automationId, 'automation:b');
  assert.equal(store.current.find((item) => item.workflow.automationId === 'automation:a').workflow.version, 1);
  assert.equal(store.current.find((item) => item.workflow.automationId === 'automation:b').workflow.inputs.message, 'Changed first visible automation');
});

test('numbered selection follows the default active-only user list', async () => {
  const records = [
    record({ automationId: 'automation:cancelled-new', taskId: 'task:1', scheduleId: 'schedule:1', message: 'Hello', localTime: '07:00', lifecycleStatus: 'cancelled' }),
    record({ automationId: 'automation:active', taskId: 'task:2', scheduleId: 'schedule:2', message: 'Hello', localTime: '07:00', lifecycleStatus: 'active' }),
    record({ automationId: 'automation:cancelled-old', taskId: 'task:3', scheduleId: 'schedule:3', message: 'Old', localTime: '16:55', lifecycleStatus: 'cancelled' })
  ];
  const recurringScheduler = {
    async list() {
      return [
        { scheduleId: 'schedule:1', status: 'cancelled' },
        { scheduleId: 'schedule:2', status: 'active' },
        { scheduleId: 'schedule:3', status: 'cancelled' }
      ];
    }
  };
  const { service } = capability(records, recurringScheduler);
  const result = await service.update({
    selector: { position: 1 },
    scope,
    patch: { inputs: { message: 'Changed active automation 1' } },
    actor
  });
  assert.equal(result.automationId, 'automation:active');
});

test('semantic update ignores cancelled duplicates and directly selects the one operational automation', async () => {
  const records = [
    record({ automationId: 'automation:cancelled', taskId: 'task:1', scheduleId: 'schedule:1', message: 'ПРИВЕТ МОНАРХ', localTime: '07:00', lifecycleStatus: 'cancelled' }),
    record({ automationId: 'automation:active', taskId: 'task:2', scheduleId: 'schedule:2', message: 'ПРИВЕТ МОНАРХ', localTime: '07:00', lifecycleStatus: 'active' })
  ];
  const { service } = capability(records);
  const result = await service.update({
    selector: { localTime: '07:00' },
    scope,
    semanticOperation: { type: 'add-step', data: { step: { type: 'compose', config: { template: 'Добавь свежую активность в доступных группах' } } } },
    actor
  });
  assert.equal(result.automationId, 'automation:active');
});

test('one exact structured target is not rejected by an imperfect AI description', async () => {
  const { service, store } = capability([
    record({ automationId: 'automation:morning', taskId: 'task:1', scheduleId: 'schedule:1', message: 'ДОБРОЕ УТРО МОЙ МОНАРХ', localTime: '07:00' }),
    record({ automationId: 'automation:evening', taskId: 'task:2', scheduleId: 'schedule:2', message: 'ВЕЧЕРНИЙ ОТЧЁТ', localTime: '19:00' })
  ]);
  const result = await service.update({
    selector: { localTime: '07:00', description: 'привет монарх информация по активности в группах' },
    scope,
    patch: { inputs: { message: 'ДОБРОЕ УТРО МОЙ МОНАРХ + АКТИВНОСТЬ' } },
    actor
  });
  assert.equal(result.automationId, 'automation:morning');
  assert.equal(store.current.find((item) => item.workflow.automationId === 'automation:evening').workflow.version, 1);
});

test('free-form description selects one active automation without ids, list position or exact stored text', async () => {
  const { service, store } = capability([
    record({ automationId: 'automation:morning', taskId: 'task:1', scheduleId: 'schedule:1', message: 'ПРИВЕТ МОНАРХ', localTime: '07:00' }),
    record({ automationId: 'automation:weather', taskId: 'task:2', scheduleId: 'schedule:2', message: 'ПРОГНОЗ ПОГОДЫ', localTime: '07:00' }),
    record({ automationId: 'automation:evening', taskId: 'task:3', scheduleId: 'schedule:3', message: 'ВЕЧЕРНИЙ ОТЧЁТ', localTime: '19:00' })
  ]);
  const result = await service.update({
    selector: { description: 'утреннее приветствие монарха' },
    scope,
    patch: { inputs: { message: 'ПРИВЕТ МОНАРХ + АКТИВНОСТЬ' } },
    actor
  });
  assert.equal(result.automationId, 'automation:morning');
  assert.equal(store.current.find((item) => item.workflow.automationId === 'automation:weather').workflow.version, 1);
});

test('free-form description remains fail-closed when two active automations are equally similar', async () => {
  const { service, auth } = capability([
    record({ automationId: 'automation:morning', taskId: 'task:1', scheduleId: 'schedule:1', message: 'ПРИВЕТ МОНАРХ УТРОМ', localTime: '07:00' }),
    record({ automationId: 'automation:evening', taskId: 'task:2', scheduleId: 'schedule:2', message: 'ПРИВЕТ МОНАРХ ВЕЧЕРОМ', localTime: '19:00' })
  ]);
  await assert.rejects(
    service.update({ selector: { description: 'приветствие монарха' }, scope, patch: { inputs: { message: 'changed' } }, actor }),
    (error) => error.code === 'workflow_update_target_ambiguous'
      && error.details?.choices?.every((choice) => !('automationId' in choice))
      && error.details.choices.some((choice) => choice.localTime === '07:00')
  );
  assert.equal(auth.calls.length, 0);
});

test('unrelated free-form description never guesses an active automation', async () => {
  const { service, auth } = capability([
    record({ automationId: 'automation:morning', taskId: 'task:1', scheduleId: 'schedule:1', message: 'ПРИВЕТ МОНАРХ', localTime: '07:00' })
  ]);
  await assert.rejects(
    service.update({ selector: { description: 'курс валют вечером' }, scope, patch: { inputs: { message: 'changed' } }, actor }),
    (error) => error.code === 'workflow_update_target_not_found'
  );
  assert.equal(auth.calls.length, 0);
});

test('AW2.8 fails closed with clarification on zero semantic matches before authorization or mutation', async () => {
  const { service, store, auth } = capability([
    record({ automationId: 'automation:morning', taskId: 'task:1', scheduleId: 'schedule:1', message: 'Morning report', localTime: '07:00' })
  ]);

  await assert.rejects(
    service.update({ selector: { localTime: '08:00' }, scope, patch: { inputs: { message: 'changed' } }, actor }),
    (error) => error.code === 'workflow_update_target_not_found'
      && error.details?.matchCount === 0
      && error.details?.clarificationRequired === true
  );

  assert.equal(auth.calls.length, 0);
  assert.equal(store.current[0].workflow.version, 1);
});

test('AW2.8 fails closed with clarification on multiple semantic matches before authorization or mutation', async () => {
  const { service, store, auth } = capability([
    record({ automationId: 'automation:one', taskId: 'task:1', scheduleId: 'schedule:1', message: 'First', localTime: '07:00' }),
    record({ automationId: 'automation:two', taskId: 'task:2', scheduleId: 'schedule:2', message: 'Second', localTime: '07:00' })
  ]);

  await assert.rejects(
    service.update({ selector: { triggerType: 'recurring', localTime: '07:00' }, scope, patch: { inputs: { message: 'changed' } }, actor }),
    (error) => error.code === 'workflow_update_target_ambiguous'
      && error.details?.matchCount === 2
      && error.details?.clarificationRequired === true
  );

  assert.equal(auth.calls.length, 0);
  assert.equal(store.current.every((item) => item.workflow.version === 1), true);
});

test('AW2.8 candidate discovery is bounded to canonical scope', async () => {
  const { service, store } = capability([
    record({ automationId: 'automation:mine', taskId: 'task:mine', scheduleId: 'schedule:mine', message: 'Scoped report', localTime: '07:00' }),
    record({ automationId: 'automation:other', taskId: 'task:other', scheduleId: 'schedule:other', message: 'Scoped report', localTime: '07:00', workflowScope: otherScope })
  ]);

  const result = await service.update({
    selector: { notificationMessage: 'Scoped report', localTime: '07:00' },
    scope,
    patch: { inputs: { message: 'Mine only' } },
    actor
  });

  assert.equal(result.automationId, 'automation:mine');
  assert.equal(store.current.find((item) => item.workflow.automationId === 'automation:other').workflow.version, 1);
});

test('AW2.8 rejects invented or unsupported selector attributes instead of guessing', async () => {
  const { service, auth } = capability([
    record({ automationId: 'automation:morning', taskId: 'task:1', scheduleId: 'schedule:1', message: 'Morning report', localTime: '07:00' })
  ]);

  await assert.rejects(
    service.update({ selector: { title: 'morning automation' }, scope, patch: { inputs: { message: 'changed' } }, actor }),
    (error) => error.code === 'workflow_update_selector_invalid'
  );
  assert.equal(auth.calls.length, 0);
});
