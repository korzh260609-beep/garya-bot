import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import { createPostgresTaskQueue } from '../src/automation/postgresTaskQueue.js';
import { createPostgresWorkflowExecutionStore } from '../src/automation/postgresWorkflowExecutionStore.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('AW2.3 PostgreSQL workflow execution store persists terminal step state and evidence', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-aw2-3-step-store-test' });
  await persistence.start();

  try {
    const suffix = randomUUID();
    const taskId = `aw2.3:store:${suffix}`;
    const automationId = `automation:${suffix}`;
    const scope = { globalUserId: `user:${suffix}`, projectScope: 'sg2.1' };
    const queue = createPostgresTaskQueue({ database: persistence.database });
    const store = createPostgresWorkflowExecutionStore({ database: persistence.database });

    await queue.submit({
      taskId,
      kind: 'workflow-execution-test',
      scope,
      payload: { source: 'aw2.3-integration-test' }
    });

    const running = await store.recordStep({
      taskId,
      automationId,
      workflowVersion: 2,
      stepIndex: 0,
      stepType: 'collect',
      status: 'running',
      output: null,
      evidenceRefs: []
    });
    assert.equal(running.status, 'running');
    assert.equal(running.completed_at, null);

    const completed = await store.recordStep({
      taskId,
      automationId,
      workflowVersion: 2,
      stepIndex: 0,
      stepType: 'collect',
      status: 'completed',
      output: { count: 3 },
      evidenceRefs: ['workspace:activity:1']
    });
    assert.equal(completed.status, 'completed');
    assert.ok(completed.completed_at);

    const steps = await store.listSteps(taskId);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].automation_id, automationId);
    assert.equal(steps[0].workflow_version, 2);
    assert.equal(steps[0].step_index, 0);
    assert.equal(steps[0].step_type, 'collect');
    assert.equal(steps[0].status, 'completed');
    assert.deepEqual(steps[0].output, { count: 3 });
    assert.deepEqual(steps[0].evidence_refs, ['workspace:activity:1']);
  } finally {
    await persistence.close();
  }
});
