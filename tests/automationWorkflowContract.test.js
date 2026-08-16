import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKFLOW_SCHEMA_VERSION,
  WORKFLOW_STEP_TYPES,
  adaptSelfNotificationTaskToWorkflow,
  assertSupportedWorkflowSchema,
  assertSupportedWorkflowStepType,
  createWorkflowDefinition,
  createWorkflowStep
} from '../src/automation/index.js';

const baseWorkflow = {
  schemaVersion: WORKFLOW_SCHEMA_VERSION,
  automationId: 'automation-1',
  version: 1,
  trigger: { type: 'one-shot', runAt: '2026-08-17T07:00:00.000Z' },
  steps: [{ type: 'compose', mode: 'static-message', input: 'message' }, { type: 'deliver' }],
  inputs: { message: 'Доброе утро' },
  delivery: { transport: 'telegram', recipientGlobalUserId: 'global:monarch' },
  executionPolicy: { maxAttempts: 3 },
  scope: { globalUserId: 'global:monarch', projectScope: 'sg2.1' },
  createdBy: 'global:monarch',
  updatedBy: 'global:monarch',
  createdAt: '2026-08-16T10:00:00.000Z',
  updatedAt: '2026-08-16T10:00:00.000Z',
  provenance: { source: 'canonical-user-request', requestId: 'request-1' }
};

test('AW2.1 workflow contract materializes canonical required fields', () => {
  const workflow = createWorkflowDefinition(baseWorkflow);
  assert.equal(workflow.schemaVersion, 1);
  assert.equal(workflow.automationId, 'automation-1');
  assert.equal(workflow.version, 1);
  assert.equal(workflow.trigger.type, 'one-shot');
  assert.equal(workflow.steps.length, 2);
  assert.equal(workflow.scope.globalUserId, 'global:monarch');
  assert.equal(workflow.scope.groupScope, null);
  assert.equal(workflow.provenance.requestId, 'request-1');
  assert.equal(Object.isFrozen(workflow), true);
  assert.equal(Object.isFrozen(workflow.steps), true);
  assert.equal(Object.isFrozen(workflow.inputs), true);
});

test('AW2.1 schema and workflow version guards fail closed', () => {
  assert.equal(assertSupportedWorkflowSchema(1), 1);
  assert.throws(() => assertSupportedWorkflowSchema(2), /unsupported workflow schema version: 2/);
  assert.throws(() => createWorkflowDefinition({ ...baseWorkflow, version: 0 }), /workflow.version must be a positive integer/);
  assert.throws(() => createWorkflowDefinition({ ...baseWorkflow, trigger: { type: 'event' } }), /unsupported workflow trigger type/);
});

test('AW2.2 exposes exactly the six canonical workflow step types', () => {
  assert.deepEqual(WORKFLOW_STEP_TYPES, [
    'collect',
    'retrieve',
    'analyze',
    'compose',
    'invoke-capability',
    'deliver'
  ]);
  for (const type of WORKFLOW_STEP_TYPES) assert.equal(assertSupportedWorkflowStepType(type), type);
});

test('AW2.2 canonical step contract preserves bounded JSON metadata and freezes it', () => {
  const step = createWorkflowStep({
    type: 'collect',
    source: { capability: 'workspace-activity', resources: ['workspace-1'] },
    output: 'activity'
  });

  assert.equal(step.type, 'collect');
  assert.equal(step.source.capability, 'workspace-activity');
  assert.equal(step.output, 'activity');
  assert.equal(Object.isFrozen(step), true);
  assert.equal(Object.isFrozen(step.source), true);
  assert.equal(Object.isFrozen(step.source.resources), true);
});

test('AW2.2 workflow definition rejects missing or unsupported step types', () => {
  assert.throws(
    () => createWorkflowDefinition({ ...baseWorkflow, steps: [{ mode: 'static-message' }] }),
    /workflow\.steps\[0\]\.type must be a non-empty string/
  );
  assert.throws(
    () => createWorkflowDefinition({ ...baseWorkflow, steps: [{ type: 'send-message' }] }),
    /unsupported workflow step type: send-message/
  );
  assert.throws(() => assertSupportedWorkflowStepType('keyword-route'), /unsupported workflow step type: keyword-route/);
});

test('AW2.2 all canonical step classes can coexist in ordered workflow steps without executing them', () => {
  const workflow = createWorkflowDefinition({
    ...baseWorkflow,
    steps: WORKFLOW_STEP_TYPES.map((type, index) => ({ type, orderEvidence: index + 1 }))
  });

  assert.deepEqual(workflow.steps.map((step) => step.type), WORKFLOW_STEP_TYPES);
  assert.deepEqual(workflow.steps.map((step) => step.orderEvidence), [1, 2, 3, 4, 5, 6]);
});

test('AW2.1 adapts existing in-memory self-notification without mutating it', () => {
  const legacy = {
    id: 'task-legacy-1',
    kind: 'self-notification',
    payload: {
      message: 'Напомнить проверить отчёт',
      automation: { source: 'canonical-user-request', capability: 'task-create' },
      delivery: {
        recipientGlobalUserId: 'global:monarch',
        projectScope: 'sg2.1',
        originBoundSelfNotification: true,
        originTarget: { transport: 'telegram', address: '12345' }
      }
    },
    scopeContext: { globalUserId: 'global:monarch', projectScope: 'sg2.1' },
    traceContext: { traceId: 'trace-legacy' },
    runAt: '2026-08-17T07:00:00.000Z',
    maxAttempts: 3,
    protectedAction: true,
    confirmationRequired: false,
    createdAt: '2026-08-16T10:00:00.000Z',
    updatedAt: '2026-08-16T10:05:00.000Z'
  };
  const before = structuredClone(legacy);
  const workflow = adaptSelfNotificationTaskToWorkflow(legacy);

  assert.deepEqual(legacy, before);
  assert.equal(workflow.automationId, legacy.id);
  assert.equal(workflow.version, 1);
  assert.equal(workflow.trigger.type, 'one-shot');
  assert.equal(workflow.inputs.message, legacy.payload.message);
  assert.equal(workflow.steps[0].type, 'compose');
  assert.equal(workflow.steps[1].type, 'deliver');
  assert.equal(workflow.delivery.originTarget.address, '12345');
  assert.equal(workflow.scope.globalUserId, 'global:monarch');
  assert.equal(workflow.executionPolicy.protectedAction, true);
  assert.equal(workflow.provenance.legacyTaskId, legacy.id);
});

test('AW2.1 adapts persisted recurring self-notification snake_case shape', () => {
  const workflow = adaptSelfNotificationTaskToWorkflow({
    task_id: 'task-db-1',
    kind: 'self-notification',
    global_user_id: 'global:monarch',
    project_scope: 'sg2.1',
    group_scope: 'group-1',
    thread_scope: null,
    payload: {
      message: 'Ежедневный отчёт',
      recurrence: { frequency: 'DAILY', interval: 1, timezone: 'Europe/Kiev' },
      automation: { source: 'canonical-user-request', capability: 'task-create' },
      delivery: {
        recipientGlobalUserId: 'global:monarch',
        projectScope: 'sg2.1',
        originBoundSelfNotification: true,
        originTarget: { transport: 'telegram', address: '12345' }
      }
    },
    max_attempts: 4,
    protected_action: true,
    created_at: new Date('2026-08-16T10:00:00.000Z'),
    updated_at: new Date('2026-08-16T10:05:00.000Z')
  });

  assert.equal(workflow.automationId, 'task-db-1');
  assert.equal(workflow.trigger.type, 'recurring');
  assert.equal(workflow.trigger.recurrence.frequency, 'DAILY');
  assert.equal(workflow.scope.groupScope, 'group-1');
  assert.equal(workflow.executionPolicy.maxAttempts, 4);
  assert.equal(workflow.createdAt, '2026-08-16T10:00:00.000Z');
});

test('AW2.1 legacy adapter rejects non self-notification tasks', () => {
  assert.throws(() => adaptSelfNotificationTaskToWorkflow({ kind: 'user-task', payload: {} }), /only self-notification tasks/);
});
