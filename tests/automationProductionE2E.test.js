import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionExecutableWorkflowRuntime } from '../src/automation/productionExecutableWorkflowRuntime.js';
import { createProductionWorkerExecutor } from '../src/automation/productionWorkerExecution.js';

const W1 = 'tgw_aw220one';
const W2 = 'tgw_aw220two';
const OCCURRENCE = 'schedule:aw220:42';

function workflow({ symbolic = false } = {}) {
  return {
    schemaVersion: 1,
    automationId: 'automation:aw220',
    version: 2,
    trigger: {
      type: 'recurring',
      recurrence: { rule: 'FREQ=DAILY', timeZone: 'Europe/Kyiv', dtstartLocal: '2026-08-18T07:00:00' }
    },
    steps: [
      {
        type: 'collect',
        security: { protected: true },
        source: {
          capability: 'workspace-activity',
          ...(symbolic ? { workspaceSelection: 'authorized-current' } : { workspaceIds: [W1, W2] }),
          dataWindow: { from: '2026-08-17T00:00:00.000Z', to: '2026-08-17T20:00:00.000Z' }
        }
      },
      {
        type: 'compose',
        security: { protected: true },
        composition: { mode: 'deterministic', heading: 'Current workspace activity', ...(symbolic ? { prefixInput: 'message' } : {}) }
      },
      { type: 'deliver', mode: 'legacy-self-notification' }
    ],
    inputs: { message: symbolic ? 'ПРИВЕТ МОНАРХ' : 'stale prepared text must never be delivered' },
    delivery: {
      originTarget: { transport: 'telegram', address: '1001' },
      recipientGlobalUserId: 'user:aw220',
      projectScope: 'sg2.1',
      originBoundSelfNotification: true
    },
    executionPolicy: { maxAttempts: 3, confirmationRequired: false },
    scope: { globalUserId: 'user:aw220', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    createdBy: 'user:aw220',
    updatedBy: 'user:aw220',
    createdAt: '2026-08-17T00:00:00.000Z',
    updatedAt: '2026-08-17T01:00:00.000Z',
    provenance: { source: 'aw220-production-e2e' }
  };
}

function memoryRunStore() {
  const runs = [];
  const steps = [];
  const events = [];
  return {
    runs,
    steps,
    events,
    async startRun(record) { runs.push({ phase: 'started', ...record }); },
    async recordStep(record) { steps.push(record); },
    async recordRunEvent(record) { events.push(record); },
    async completeRun(record) { runs.push({ phase: 'completed', ...record }); }
  };
}

function runtimeFixture({ symbolic = false } = {}) {
  const resolved = [];
  const authorityCalls = [];
  const actionGateCalls = [];
  const workspaceReads = [];
  const deliveries = [];
  const deliveredByKey = new Map();
  const stepRunStore = memoryRunStore();
  const definition = workflow({ symbolic });
  const workspaceRegistry = {
    async listWorkspaces() {
      return [
        { workspaceId: W1, title: 'Монаршая группа', lifecycleState: 'ACTIVE' },
        { workspaceId: W2, title: 'Закрытая группа', lifecycleState: 'ACTIVE' }
      ];
    }
  };

  const workflowStore = {
    async resolveVersion(request) {
      resolved.push(request);
      return request.automationId === definition.automationId && request.version === 2
        ? { workflow: definition }
        : null;
    }
  };
  const workspaceOperationsStore = {
    async countRecords({ workspaceId, domain }) {
      workspaceReads.push({ method: 'countRecords', workspaceId, domain });
      assert.equal(workspaceId, W1);
      return domain === 'poll' ? 2 : domain === 'test' ? 1 : 0;
    },
    async aggregateEventActors({ workspaceId }) {
      workspaceReads.push({ method: 'aggregateEventActors', workspaceId });
      assert.equal(workspaceId, W1);
      return { uniqueActors: 4, interactionEvents: 7 };
    },
    async aggregateEvents({ workspaceId }) {
      workspaceReads.push({ method: 'aggregateEvents', workspaceId });
      assert.equal(workspaceId, W1);
      return { 'content.published': 3, 'message.reaction': 7 };
    }
  };
  const workspaceAuthority = {
    async verify(request) {
      authorityCalls.push(request);
      if (request.workspaceId === W2) {
        return { allowed: false, reason: 'twm-workspace-authority-denied', resourceAuthority: null };
      }
      return {
        allowed: true,
        reason: 'twm-workspace-authority-verified',
        resourceAuthority: {
          allowed: true,
          actorGlobalUserId: 'user:aw220',
          projectScope: 'sg2.1',
          resourceId: W1,
          requiredRelation: 'can_read',
          evidenceRefs: ['authority:workspace-live']
        }
      };
    }
  };
  const botCapabilityService = {
    async checkCapabilities({ workspaceId, requireFresh }) {
      assert.equal(workspaceId, W1);
      assert.equal(requireFresh, true);
      return { available: true, reason: 'telegram-bot-capability-available' };
    }
  };
  const actionGate = {
    evaluate(request) {
      actionGateCalls.push(request);
      return { outcome: 'allow', reasons: [] };
    }
  };
  const credentialManager = {
    describeCredential(credentialId) {
      assert.equal(credentialId, 'sg.telegram.bot');
      return { credentialId, state: 'active', version: 5 };
    }
  };
  const deliveryRouter = {
    async route(request) {
      if (deliveredByKey.has(request.idempotencyKey)) {
        return { ...deliveredByKey.get(request.idempotencyKey), duplicate: true };
      }
      deliveries.push(request);
      const result = { status: 'delivered', deliveryId: 'delivery:aw220' };
      deliveredByKey.set(request.idempotencyKey, result);
      return result;
    }
  };

  const createRuntime = () => createProductionExecutableWorkflowRuntime({
    workflowStore,
    stepRunStore,
    workspaceOperationsStore,
    ...(symbolic ? { workspaceRegistry } : {}),
    workspaceAuthority,
    botCapabilityService,
    actionGate,
    credentialManager,
    deliveryRouter,
    clock: () => '2026-08-17T20:00:01.000Z'
  });

  return {
    createRuntime,
    resolved,
    authorityCalls,
    actionGateCalls,
    workspaceReads,
    deliveries,
    stepRunStore
  };
}

test('live phrase workspace selection resolves only current authorized groups, rechecks them and hides internal ids', async () => {
  const fixture = runtimeFixture({ symbolic: true });
  const result = await fixture.createRuntime().execute({
    taskId: 'task:aw220',
    payload: { workflow: { automationId: 'automation:aw220', version: 2 }, occurrenceId: 'schedule:aw220:symbolic' },
    attempt: 1,
    idempotencyKey: 'task-occurrence:aw220:symbolic',
    traceContext: { traceId: 'trace:aw220:symbolic', requestId: 'request:aw220:symbolic' },
    scope: { globalUserId: 'user:aw220', projectScope: 'sg2.1' }
  });
  assert.equal(result.outcome, 'completed');
  assert.equal(fixture.authorityCalls.filter((call) => call.workspaceId === W1 && call.forceFresh === true).length >= 2, true);
  assert.equal(fixture.workspaceReads.some((call) => call.workspaceId === W2), false);
  assert.equal(fixture.deliveries.length, 1);
  assert.match(fixture.deliveries[0].message, /^ПРИВЕТ МОНАРХ/);
  assert.match(fixture.deliveries[0].message, /Монаршая группа/);
  assert.equal(fixture.deliveries[0].message.includes(W1), false);
  assert.equal(fixture.deliveries[0].message.includes(W2), false);
});

test('AW2.20 production workflow resolves the pinned version, reauthorizes each workspace, uses fresh data and delivers once across restart', async () => {
  const fixture = runtimeFixture();
  const request = {
    taskId: 'task:aw220',
    payload: { workflow: { automationId: 'automation:aw220', version: 2 }, occurrenceId: OCCURRENCE },
    attempt: 1,
    idempotencyKey: 'task-occurrence:aw220:42',
    traceContext: { traceId: 'trace:aw220', requestId: 'request:aw220' },
    scope: { globalUserId: 'user:aw220', projectScope: 'sg2.1' }
  };

  const first = await fixture.createRuntime().execute(request);

  assert.equal(first.outcome, 'partial');
  assert.equal(first.workflowVersion, 2);
  assert.deepEqual(fixture.resolved[0], {
    automationId: 'automation:aw220',
    version: 2,
    scope: request.scope
  });
  assert.equal(fixture.authorityCalls.some((call) => call.workspaceId === W1 && call.forceFresh === true), true);
  assert.equal(fixture.authorityCalls.some((call) => call.workspaceId === W2 && call.forceFresh === true), true);
  assert.equal(fixture.workspaceReads.some((call) => call.workspaceId === W2), false);
  assert.equal(fixture.actionGateCalls.some((call) => call.payload.workspaceId === W1), true);
  assert.equal(fixture.actionGateCalls.some((call) => call.payload.workspaceId === W2), false);
  assert.equal(fixture.deliveries.length, 1);
  assert.match(fixture.deliveries[0].message, /Publications: 3/);
  assert.match(fixture.deliveries[0].message, /Interaction events: 7/);
  assert.match(fixture.deliveries[0].message, new RegExp(`${W1}; unique actors: 4`));
  assert.match(fixture.deliveries[0].message, new RegExp(`${W2}: twm-workspace-authority-denied`));
  assert.equal(fixture.deliveries[0].message.includes('stale prepared text'), false);
  assert.equal(fixture.deliveries[0].message.includes('Total unique actors'), false);
  assert.equal(fixture.stepRunStore.events.some((event) => event.eventType === 'gate-decision'), true);
  assert.equal(fixture.stepRunStore.events.some((event) => event.eventType === 'source-result'), true);
  assert.equal(fixture.stepRunStore.events.some((event) => event.eventType === 'delivery-result'), true);

  const restarted = fixture.createRuntime();
  const second = await restarted.execute({ ...request, attempt: 2 });

  assert.equal(second.outcome, 'partial');
  assert.equal(fixture.deliveries.length, 1);
  assert.equal(second.occurrenceId, OCCURRENCE);
  assert.equal(fixture.stepRunStore.runs.some((run) => run.phase === 'completed' && run.status === 'partial'), true);
});

test('AW2.20 production worker routes executable self-notifications to the workflow runtime and fails closed when it is unavailable', async () => {
  const workflowCalls = [];
  const deliveryCalls = [];
  const payload = {
    automation: { source: 'canonical-user-request', capability: 'task-create' },
    message: 'legacy fallback',
    workflow: { automationId: 'automation:aw220', version: 2 },
    delivery: {
      recipientGlobalUserId: 'user:aw220',
      projectScope: 'sg2.1',
      originBoundSelfNotification: true,
      originTarget: { transport: 'telegram', address: '1001' }
    }
  };
  const request = {
    taskId: 'task:aw220',
    kind: 'self-notification',
    payload,
    attempt: 1,
    idempotencyKey: 'task-occurrence:aw220:42',
    traceContext: { traceId: 'trace:aw220', requestId: 'request:aw220' },
    scope: { globalUserId: 'user:aw220', projectScope: 'sg2.1' }
  };
  const executor = createProductionWorkerExecutor({
    deliveryRouter: { async route(value) { deliveryCalls.push(value); return { status: 'delivered' }; } },
    workflowExecution: { async execute(value) { workflowCalls.push(value); return { outcome: 'completed' }; } }
  });

  assert.deepEqual(await executor(request), { outcome: 'completed' });
  assert.equal(workflowCalls.length, 1);
  assert.equal(deliveryCalls.length, 0);

  const unavailable = createProductionWorkerExecutor({
    deliveryRouter: { async route() { return { status: 'delivered' }; } }
  });
  await assert.rejects(
    () => unavailable(request),
    (error) => error.code === 'automation-workflow-runtime-unavailable' && error.retryable === false
  );
});
