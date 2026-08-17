import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeFreshDataCollectHandler } from '../src/automation/runtimeFreshDataCollection.js';
import { createMultiWorkspaceActivityAggregator } from '../src/automation/multiWorkspaceActivityAggregator.js';
import { WORKSPACE_ACTIVITY_CAPABILITY } from '../src/automation/workspaceActivityCollector.js';

const W1 = 'tgw_aw213one';
const W2 = 'tgw_aw213two';
const W3 = 'tgw_aw213three';

function parentContext(workspaceIds = [W1, W2]) {
  return {
    taskId: 'task:aw213',
    automationId: 'automation:aw213',
    workflowVersion: 3,
    scope: { globalUserId: 'user:aw213' },
    stepIndex: 0,
    step: {
      type: 'collect',
      security: { protected: true },
      source: {
        capability: WORKSPACE_ACTIVITY_CAPABILITY,
        workspaceIds,
        dataWindow: { from: '2026-08-17T08:00:00.000Z', to: '2026-08-17T09:00:00.000Z' }
      }
    },
    securityVerdict: { allowed: true, evidenceRefs: ['security:parent'] },
    traceContext: { traceId: 'trace:aw213' }
  };
}

function activityResult(workspaceId, n) {
  return {
    outcome: 'completed',
    data: {
      workspaceId,
      window: { from: '2026-08-17T08:00:00.000Z', to: '2026-08-17T09:00:00.000Z' },
      publications: n,
      polls: n + 1,
      tests: n + 2,
      interactions: { uniqueActors: n + 10, events: n + 3 },
      activityEvents: { 'content.published': n, 'test.completed': n + 2 }
    },
    sourceMetadata: { capability: WORKSPACE_ACTIVITY_CAPABILITY, workspaceId },
    evidenceRefs: [`workspace:${workspaceId}:activity`]
  };
}

test('AW2.13 independently rechecks every workspace and aggregates only additive authoritative metrics', async () => {
  const securityCalls = [];
  const collectorCalls = [];
  const aggregate = createMultiWorkspaceActivityAggregator({
    async recheckProtectedStep(context) {
      securityCalls.push(context);
      return { allowed: true, evidenceRefs: [`security:${context.step.source.workspaceId}`] };
    },
    async collectWorkspaceActivity(context) {
      collectorCalls.push(context);
      return activityResult(context.step.source.workspaceId, context.step.source.workspaceId === W1 ? 1 : 4);
    }
  });

  const result = await aggregate(parentContext());

  assert.equal(result.outcome, 'completed');
  assert.deepEqual(securityCalls.map((call) => call.step.source.workspaceId), [W1, W2]);
  assert.deepEqual(collectorCalls.map((call) => call.step.source.workspaceId), [W1, W2]);
  assert.ok(securityCalls.every((call) => !('workspaceIds' in call.step.source)));
  assert.deepEqual(result.data.totals, {
    publications: 5,
    polls: 7,
    tests: 9,
    interactionEvents: 11,
    activityEvents: { 'content.published': 5, 'test.completed': 9 }
  });
  assert.equal('uniqueActors' in result.data.totals, false);
  assert.deepEqual(result.data.workspaces.map((entry) => entry.data.interactions.uniqueActors), [11, 14]);
  assert.deepEqual(result.data.omissions, []);
});

test('AW2.13 reports lost authority as an explicit omission and never reads that workspace', async () => {
  const collectorCalls = [];
  const aggregate = createMultiWorkspaceActivityAggregator({
    async recheckProtectedStep(context) {
      const workspaceId = context.step.source.workspaceId;
      if (workspaceId === W2) {
        return { allowed: false, failedCheck: 'resourceAuthority', reason: 'resource-authority-revoked', evidenceRefs: ['authority:revoked'] };
      }
      return { allowed: true, evidenceRefs: [`security:${workspaceId}`] };
    },
    async collectWorkspaceActivity(context) {
      collectorCalls.push(context.step.source.workspaceId);
      return activityResult(context.step.source.workspaceId, 2);
    }
  });

  const result = await aggregate(parentContext([W1, W2, W3]));

  assert.equal(result.outcome, 'partial');
  assert.deepEqual(collectorCalls, [W1, W3]);
  assert.deepEqual(result.data.workspaces.map((entry) => entry.workspaceId), [W1, W3]);
  assert.deepEqual(result.data.omissions, [{
    workspaceId: W2,
    reason: 'resource-authority-revoked',
    failedCheck: 'resourceAuthority',
    errorCode: null,
    evidenceRefs: ['authority:revoked']
  }]);
  assert.equal(result.sourceMetadata.omittedWorkspaceCount, 1);
});

test('AW2.13 converts an unavailable authorized workspace into an omission instead of invented zeroes', async () => {
  const aggregate = createMultiWorkspaceActivityAggregator({
    async recheckProtectedStep(context) {
      return { allowed: true, evidenceRefs: [`security:${context.step.source.workspaceId}`] };
    },
    async collectWorkspaceActivity(context) {
      if (context.step.source.workspaceId === W2) {
        const error = new Error('workspace store unavailable');
        error.code = 'workspace_store_unavailable';
        throw error;
      }
      return activityResult(context.step.source.workspaceId, 3);
    }
  });

  const result = await aggregate(parentContext());

  assert.equal(result.outcome, 'partial');
  assert.equal(result.data.workspaces.length, 1);
  assert.deepEqual(result.data.omissions, [{
    workspaceId: W2,
    reason: 'workspace-collection-unavailable',
    failedCheck: null,
    errorCode: 'workspace_store_unavailable',
    evidenceRefs: []
  }]);
  assert.deepEqual(result.data.totals, {
    publications: 3,
    polls: 4,
    tests: 5,
    interactionEvents: 6,
    activityEvents: { 'content.published': 3, 'test.completed': 5 }
  });
});

test('AW2.13 validates multi-workspace scope before any current-security check', async () => {
  let securityCalls = 0;
  const aggregate = createMultiWorkspaceActivityAggregator({
    async recheckProtectedStep() {
      securityCalls += 1;
      return { allowed: true };
    },
    async collectWorkspaceActivity() {
      throw new Error('must not collect');
    }
  });

  await assert.rejects(() => aggregate(parentContext([])), (error) => error.code === 'multi_workspace_ids_required');
  await assert.rejects(() => aggregate(parentContext([W1, W1])), (error) => error.code === 'multi_workspace_ids_duplicate');
  await assert.rejects(() => aggregate(parentContext(['not-canonical'])), (error) => error.code === 'twm-cross-workspace-denied');
  assert.equal(securityCalls, 0);
});

test('AW2.13 composes under AW2.11 without exposing stale workflow inputs or handoff', async () => {
  const seen = [];
  const aggregate = createMultiWorkspaceActivityAggregator({
    async recheckProtectedStep(context) {
      return { allowed: true, evidenceRefs: [`security:${context.step.source.workspaceId}`] };
    },
    async collectWorkspaceActivity(context) {
      seen.push(context);
      return activityResult(context.step.source.workspaceId, 1);
    }
  });
  const handler = createRuntimeFreshDataCollectHandler({ collectCurrent: aggregate, clock: () => '2026-08-17T09:00:01.000Z' });
  const parent = parentContext();
  const result = await handler({
    taskId: parent.taskId,
    workflow: { automationId: parent.automationId, version: parent.workflowVersion, scope: parent.scope, inputs: { stale: 999 } },
    step: parent.step,
    stepIndex: 0,
    handoff: { stale: 999 },
    securityVerdict: parent.securityVerdict,
    traceContext: parent.traceContext
  });

  assert.equal(result.outcome, 'completed');
  assert.equal(result.output.collectedAt, '2026-08-17T09:00:01.000Z');
  assert.ok(seen.every((context) => !('inputs' in context) && !('handoff' in context)));
});
