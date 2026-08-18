import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createWorkflowUpdateCapability } from '../src/automation/workflowUpdate.js';
import { compileWorkflowLifecycleOperation } from '../src/automation/workflowNaturalLanguageLifecycle.js';
import { createPostgresTaskQueue } from '../src/automation/postgresTaskQueue.js';
import { createPostgresPersistence } from '../src/persistence/index.js';

const scope = Object.freeze({ globalUserId: 'user:aw218', projectScope: 'sg2.1', groupScope: null, threadScope: null });
const actor = Object.freeze({ globalUserId: 'user:aw218', roles: ['owner'] });

function workflow(version = 3) {
  return {
    schemaVersion: 1,
    automationId: 'automation:aw218',
    version,
    trigger: { type: 'recurring', recurrence: { rule: 'FREQ=DAILY', timeZone: 'Europe/Kyiv', dtstartLocal: '2026-08-18T07:00:00' } },
    steps: [{ type: 'compose', mode: 'static-message', input: 'message' }, { type: 'deliver', mode: 'legacy-self-notification' }],
    inputs: { message: `message-v${version}` },
    delivery: { transport: 'telegram', target: 'self', format: 'plain' },
    executionPolicy: { maxAttempts: 3 },
    scope,
    createdBy: actor.globalUserId, updatedBy: actor.globalUserId,
    createdAt: '2026-08-17T12:00:00.000Z', updatedAt: '2026-08-17T12:00:00.000Z',
    provenance: { source: 'aw2.18-test' }
  };
}

function fixture({ oneShot = false } = {}) {
  let current = { workflow: workflow(), taskId: 'task:aw218', scheduleId: oneShot ? null : 'schedule:aw218', lifecycleStatus: 'active' };
  if (oneShot) current.workflow = { ...current.workflow, trigger: { type: 'one-shot', runAt: '2026-08-20T07:00:00.000Z' } };
  const originalV1 = {
    ...workflow(1),
    steps: [{ type: 'collect', security: { protected: true }, source: { capability: 'workspace-activity' } }, ...workflow(1).steps],
    inputs: { message: 'original-v1' },
    delivery: { transport: 'telegram', target: 'self', format: 'markdown' }
  };
  const history = [
    { automationId: current.workflow.automationId, version: 3, workflow: structuredClone(current.workflow) },
    { automationId: current.workflow.automationId, version: 1, workflow: structuredClone(originalV1) }
  ];
  const commits = [];
  const runtimeCalls = [];
  const store = {
    atomicRuntimeMutation: true,
    async resolve() { return [structuredClone(current)]; },
    async list() { return [structuredClone(current)]; },
    async history() { return history.map((entry) => structuredClone(entry)); },
    async commitMutation(input) {
      commits.push(structuredClone({ ...input, runtimeMutation: undefined }));
      const runtimeResult = await input.runtimeMutation({ query: async () => ({ rows: [] }) });
      current = {
        ...current,
        workflow: structuredClone(input.nextWorkflow),
        lifecycleStatus: input.lifecycleAction === 'pause' ? 'paused' : input.lifecycleAction === 'resume' ? 'active' : input.lifecycleAction === 'cancel' ? 'cancelled' : current.lifecycleStatus
      };
      history.unshift({ automationId: current.workflow.automationId, version: current.workflow.version, workflow: structuredClone(current.workflow) });
      return { record: structuredClone(current), runtimeResult };
    }
  };
  const queue = {
    async syncWorkflowTask(input) { runtimeCalls.push(['sync', input]); return { task_id: input.taskId, status: 'scheduled' }; },
    async updateScheduled(input) { runtimeCalls.push(['trigger', input]); return { task_id: input.taskId, status: 'scheduled' }; },
    async pauseScheduled(input) { runtimeCalls.push(['pause', input]); return { task_id: input.taskId, status: 'schedule_paused' }; },
    async resumeScheduled(input) { runtimeCalls.push(['resume', input]); return { task_id: input.taskId, status: 'scheduled' }; },
    async cancelScheduled(input) { runtimeCalls.push(['cancel', input]); return { task_id: input.taskId, status: 'cancelled' }; }
  };
  const scheduler = Object.fromEntries(['update', 'pause', 'resume', 'cancel'].map((name) => [name, async (input) => { runtimeCalls.push([name, input]); return { scheduleId: 'schedule:aw218', status: name === 'pause' ? 'paused' : name === 'cancel' ? 'cancelled' : 'active' }; }]));
  const authCalls = [];
  const service = createWorkflowUpdateCapability({
    store,
    recurringScheduler: scheduler,
    oneShotTaskQueue: queue,
    authorization: { async authorize(input) { authCalls.push(structuredClone(input)); return { allowed: true, reason: 'aw218-test' }; } },
    clock: () => new Date('2026-08-17T18:00:00.000Z')
  });
  return { service, store, queue, scheduler, commits, runtimeCalls, authCalls, current: () => structuredClone(current) };
}

test('AW2.18 compiles semantic add/remove/replace/style/trigger operations without phrase matching', async () => {
  const f = fixture();
  const selector = { automationId: 'automation:aw218' };
  const common = { selector, scope, actor };

  const added = await f.service.update({ ...common, semanticOperation: { type: 'add-step', data: { step: { type: 'collect', security: { protected: true }, source: { capability: 'workspace-activity' } } } } });
  assert.deepEqual(added.workflow.steps.map((step) => step.type), ['compose', 'collect', 'deliver']);

  const styled = await f.service.update({ ...common, semanticOperation: { type: 'change-output-style', data: { deliveryPatch: { format: 'markdown' }, composePatch: { tone: 'brief' } } } });
  assert.equal(styled.workflow.delivery.format, 'markdown');
  assert.equal(styled.workflow.steps.find((step) => step.type === 'compose').tone, 'brief');

  const removed = await f.service.update({ ...common, semanticOperation: { type: 'remove-step', data: { target: { type: 'collect' } } } });
  assert.deepEqual(removed.workflow.steps.map((step) => step.type), ['compose', 'deliver']);

  const replaced = await f.service.update({ ...common, semanticOperation: { type: 'replace-workflow', data: { steps: [{ type: 'retrieve', security: { protected: true }, source: { capability: 'approved-source' } }, { type: 'deliver' }], inputs: { query: 'current status' } } } });
  assert.deepEqual(replaced.workflow.steps.map((step) => step.type), ['retrieve', 'deliver']);
  assert.equal(replaced.workflow.inputs.query, 'current status');

  const rescheduled = await f.service.update({ ...common, semanticOperation: { type: 'change-trigger', data: { trigger: { type: 'recurring', recurrence: { rule: 'FREQ=WEEKLY;BYDAY=MO', timeZone: 'Europe/Kyiv', dtstartLocal: '2026-08-24T08:30:00' } } } } });
  assert.equal(rescheduled.workflow.trigger.recurrence.rule, 'FREQ=WEEKLY;BYDAY=MO');
  assert.ok(f.runtimeCalls.some(([name]) => name === 'update'));
  assert.ok(f.authCalls.every((call) => call.semanticOperation?.type));
  assert.equal(f.commits.every((commit) => commit.patchSummary.semanticOperation != null), true);
});

test('live automation update compiles authorized-current activity into collect, dynamic compose and delivery without workspace ids', () => {
  const compiled = compileWorkflowLifecycleOperation({
    currentWorkflow: workflow(),
    operation: { type: 'add-workspace-activity', data: { workspaceSelection: 'authorized-current' } }
  });
  assert.deepEqual(compiled.patch.steps.map((step) => step.type), ['collect', 'compose', 'deliver']);
  assert.deepEqual(compiled.patch.steps[0].source, {
    capability: 'workspace-activity',
    workspaceSelection: 'authorized-current'
  });
  assert.equal(compiled.patch.steps[1].composition.prefixInput, 'message');
  assert.equal(compiled.patch.steps[1].security.protected, true);
});

test('AW2.18 restores an earlier snapshot as a new version without changing automation identity', async () => {
  const f = fixture();
  const result = await f.service.update({
    selector: { automationId: 'automation:aw218' }, scope, actor,
    semanticOperation: { type: 'restore-version', data: { version: 1 } }
  });

  assert.equal(result.automationId, 'automation:aw218');
  assert.equal(result.previousVersion, 3);
  assert.equal(result.version, 4);
  assert.equal(result.restoredFromVersion, 1);
  assert.equal(result.workflow.inputs.message, 'original-v1');
  assert.deepEqual(result.workflow.steps.map((step) => step.type), ['collect', 'compose', 'deliver']);
  assert.ok(f.runtimeCalls.some(([name]) => name === 'update'));
  assert.equal(f.commits[0].patchSummary.restoredFromVersion, 1);
});

test('AW2.18 routes recurring and one-shot pause/resume/cancel through existing durable runtime seams', async () => {
  const recurring = fixture();
  for (const type of ['pause', 'resume', 'cancel']) {
    await recurring.service.update({ selector: { automationId: 'automation:aw218' }, scope, actor, semanticOperation: { type, data: {} } });
  }
  assert.deepEqual(recurring.runtimeCalls.filter(([name]) => ['pause', 'resume', 'cancel'].includes(name)).map(([name]) => name), ['pause', 'resume', 'cancel']);

  const oneShot = fixture({ oneShot: true });
  for (const type of ['pause', 'resume', 'cancel']) {
    await oneShot.service.update({ selector: { automationId: 'automation:aw218' }, scope, actor, semanticOperation: { type, data: {} } });
  }
  assert.deepEqual(oneShot.runtimeCalls.filter(([name]) => ['pause', 'resume', 'cancel'].includes(name)).map(([name]) => name), ['pause', 'resume', 'cancel']);
});

test('AW2.18 fails closed on ambiguous step removal and invalid restore', () => {
  const duplicated = { ...workflow(), steps: [{ type: 'compose' }, { type: 'compose' }, { type: 'deliver' }] };
  assert.throws(
    () => compileWorkflowLifecycleOperation({ currentWorkflow: duplicated, operation: { type: 'remove-step', data: { target: { type: 'compose' } } } }),
    (error) => error.code === 'workflow_lifecycle_step_ambiguous' && error.details?.clarificationRequired === true
  );
  assert.throws(
    () => compileWorkflowLifecycleOperation({ currentWorkflow: workflow(), operation: { type: 'restore-version', data: { version: 3 } }, history: [] }),
    (error) => error.code === 'workflow_lifecycle_restore_version_invalid'
  );
});

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('AW2.18 PostgreSQL one-shot lifecycle remains scoped durable and restart-safe', async () => {
  const suffix = randomUUID();
  const taskScope = { globalUserId: `user:aw218:${suffix}`, projectScope: 'sg2.1', groupScope: null, threadScope: null };
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-aw218-one-shot-lifecycle-test' });
  await persistence.start();
  try {
    const queue = createPostgresTaskQueue({ database: persistence.database });
    const task = await queue.submit({
      taskId: `task:aw218:${suffix}`,
      kind: 'self-notification',
      scope: taskScope,
      payload: { message: 'aw218' },
      runAt: new Date(Date.now() + 60_000).toISOString(),
      idempotencyKey: `aw218:${suffix}`
    });
    assert.equal(task.status, 'scheduled');
    assert.equal((await queue.pauseScheduled({ scope: taskScope, taskId: task.task_id })).status, 'schedule_paused');
    assert.equal((await queue.resumeScheduled({ scope: taskScope, taskId: task.task_id })).status, 'scheduled');
    assert.equal((await queue.cancelScheduled({ scope: taskScope, taskId: task.task_id })).status, 'cancelled');
    assert.equal(await queue.resumeScheduled({ scope: taskScope, taskId: task.task_id }), null);
    assert.equal(await queue.pauseScheduled({ scope: { ...taskScope, globalUserId: `other:${suffix}` }, taskId: task.task_id }), null);
  } finally {
    await persistence.close();
  }
});
