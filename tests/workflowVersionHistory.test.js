import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowUpdateCapability } from '../src/automation/index.js';

const scope = Object.freeze({
  globalUserId: 'user:aw2.10',
  projectScope: 'sg2.1',
  groupScope: null,
  threadScope: null
});
const actor = Object.freeze({ globalUserId: 'user:aw2.10', roles: ['owner'] });

function workflow() {
  return {
    schemaVersion: 1,
    automationId: 'automation:aw2.10:history',
    version: 1,
    trigger: {
      type: 'recurring',
      recurrence: {
        rule: 'FREQ=DAILY',
        timeZone: 'Europe/Kyiv',
        dtstartLocal: '2026-08-17T07:00:00'
      }
    },
    steps: [
      { type: 'compose', mode: 'static-message', input: 'message' },
      { type: 'deliver', mode: 'legacy-self-notification' }
    ],
    inputs: { message: 'v1' },
    delivery: { transport: 'telegram', target: 'self' },
    executionPolicy: { maxAttempts: 3, confirmationRequired: false },
    scope,
    createdBy: actor.globalUserId,
    updatedBy: actor.globalUserId,
    createdAt: '2026-08-16T12:00:00.000Z',
    updatedAt: '2026-08-16T12:00:00.000Z',
    provenance: { source: 'aw2.10-registration' }
  };
}

function validationResult(definition) {
  return {
    valid: true,
    validator: 'createWorkflowDefinition',
    schemaVersion: definition.schemaVersion
  };
}

function versionHistoryStore() {
  let current = {
    workflow: structuredClone(workflow()),
    taskId: null,
    scheduleId: 'schedule:aw2.10:history',
    lifecycleStatus: 'active'
  };
  const versions = [{
    automationId: current.workflow.automationId,
    version: 1,
    previousVersion: null,
    workflow: structuredClone(current.workflow),
    patchSummary: { fields: [], lifecycleAction: null, registration: true },
    actorGlobalUserId: actor.globalUserId,
    provenance: structuredClone(current.workflow.provenance),
    validationResult: validationResult(current.workflow),
    gateResult: { allowed: true, reason: 'workflow-registration' },
    createdAt: current.workflow.createdAt
  }];

  return {
    versions,
    async resolve({ selector }) {
      const matches = selector.automationId == null || selector.automationId === current.workflow.automationId
        ? [current]
        : [];
      return matches.map((record) => structuredClone(record));
    },
    async commitMutation(input) {
      if (current.workflow.version !== input.expectedVersion) return null;
      current = {
        ...current,
        workflow: structuredClone(input.nextWorkflow),
        lifecycleStatus: input.lifecycleAction === 'pause'
          ? 'paused'
          : input.lifecycleAction === 'resume'
            ? 'active'
            : input.lifecycleAction === 'cancel'
              ? 'cancelled'
              : current.lifecycleStatus
      };
      versions.push({
        automationId: current.workflow.automationId,
        version: input.nextWorkflow.version,
        previousVersion: input.currentWorkflow.version,
        workflow: structuredClone(input.nextWorkflow),
        patchSummary: structuredClone(input.patchSummary),
        actorGlobalUserId: input.actor.globalUserId,
        provenance: structuredClone(input.provenance),
        validationResult: validationResult(input.nextWorkflow),
        gateResult: structuredClone(input.gateResult),
        createdAt: input.nextWorkflow.updatedAt
      });
      return structuredClone(current);
    },
    async history({ automationId, limit }) {
      return versions
        .filter((entry) => entry.automationId === automationId)
        .toSorted((left, right) => right.version - left.version)
        .slice(0, limit)
        .map((entry) => structuredClone(entry));
    }
  };
}

function authorization() {
  return {
    async authorize() {
      return { allowed: true, reason: 'aw2.10-gate', evidenceRefs: ['gate:aw2.10'] };
    }
  };
}

test('AW2.10 preserves an inspectable monotonic version chain with actor timestamp provenance validation patch and gate evidence', async () => {
  const store = versionHistoryStore();
  const timestamps = [
    new Date('2026-08-16T18:00:00.000Z'),
    new Date('2026-08-16T19:00:00.000Z')
  ];
  const service = createWorkflowUpdateCapability({
    store,
    authorization: authorization(),
    recurringScheduler: null,
    clock: () => timestamps.shift()
  });

  const v2 = await service.update({
    selector: { automationId: 'automation:aw2.10:history' },
    scope,
    patch: { inputs: { message: 'v2' } },
    expectedVersion: 1,
    actor,
    provenance: { requestId: 'request:aw2.10:v2', traceId: 'trace:aw2.10:v2' }
  });
  const v3 = await service.update({
    selector: { automationId: 'automation:aw2.10:history' },
    scope,
    patch: { delivery: { transport: 'telegram', target: 'self', format: 'markdown' } },
    expectedVersion: 2,
    actor,
    provenance: { requestId: 'request:aw2.10:v3', traceId: 'trace:aw2.10:v3' }
  });

  assert.equal(v2.previousVersion, 1);
  assert.equal(v2.version, 2);
  assert.equal(v3.previousVersion, 2);
  assert.equal(v3.version, 3);

  const history = await service.history({
    selector: { automationId: 'automation:aw2.10:history' },
    scope,
    limit: 50
  });

  assert.deepEqual(history.map((entry) => [entry.version, entry.previousVersion]), [
    [3, 2],
    [2, 1],
    [1, null]
  ]);
  assert.equal(history[0].actorGlobalUserId, actor.globalUserId);
  assert.equal(history[0].createdAt, '2026-08-16T19:00:00.000Z');
  assert.deepEqual(history[0].patchSummary.fields, ['delivery']);
  assert.equal(history[0].provenance.requestId, 'request:aw2.10:v3');
  assert.equal(history[0].provenance.traceId, 'trace:aw2.10:v3');
  assert.deepEqual(history[0].validationResult, {
    valid: true,
    validator: 'createWorkflowDefinition',
    schemaVersion: 1
  });
  assert.equal(history[0].gateResult.allowed, true);
  assert.equal(history[0].gateResult.reason, 'aw2.10-gate');
  assert.equal(history[0].workflow.version, 3);
  assert.equal(history[0].workflow.inputs.message, 'v2');
  assert.equal(history[1].workflow.version, 2);
  assert.equal(history[1].workflow.inputs.message, 'v2');
  assert.equal(history[2].workflow.version, 1);
  assert.equal(history[2].workflow.inputs.message, 'v1');
});

test('AW2.10 invalid next workflow creates no version-history entry', async () => {
  const store = versionHistoryStore();
  const service = createWorkflowUpdateCapability({
    store,
    authorization: authorization(),
    recurringScheduler: null,
    clock: () => new Date('2026-08-16T18:00:00.000Z')
  });

  await assert.rejects(
    service.update({
      selector: { automationId: 'automation:aw2.10:history' },
      scope,
      patch: { steps: [] },
      expectedVersion: 1,
      actor,
      provenance: { requestId: 'request:invalid', traceId: 'trace:invalid' }
    }),
    /workflow\.steps must be a non-empty array/
  );

  assert.equal(store.versions.length, 1);
  assert.equal(store.versions[0].version, 1);
});
