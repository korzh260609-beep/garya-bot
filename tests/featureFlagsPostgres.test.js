import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresDatabase } from '../src/persistence/database.js';
import { runMigrations } from '../src/persistence/migrator.js';
import { createPostgresFeatureFlagStore } from '../src/features/postgresFeatureFlagStore.js';
import { createFeatureFlagService } from '../src/features/featureFlags.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('Block 16.16 PostgreSQL flags survive restart and stable bucketing remains unchanged', async () => {
  const database = createPostgresDatabase({ connectionString, ssl: false, applicationName: 'sg-feature-flags-test' });
  await database.start();
  await runMigrations(database);
  await database.query('TRUNCATE feature_flags');

  const store = createPostgresFeatureFlagStore({ database });
  const first = createFeatureFlagService({ store });
  await first.setFlag({
    featureId: 'feature:postgres-rollout', enabled: true, percentage: 5000,
    projects: ['sg2.1'], cohorts: ['pilot'], temporary: true, reviewAt: '2026-09-01T00:00:00.000Z'
  });
  const context = {
    environment: 'production', projectScope: 'sg2.1', globalUserId: 'user:stable', subjectKey: 'user:stable',
    cohorts: ['pilot'], roles: ['monarch'], permissionSatisfied: true, authoritySatisfied: true, actionGateSatisfied: true
  };
  const before = await first.resolve('feature:postgres-rollout', context);
  await database.close();

  const restartedDb = createPostgresDatabase({ connectionString, ssl: false, applicationName: 'sg-feature-flags-restart-test' });
  await restartedDb.start();
  const restarted = createFeatureFlagService({ store: createPostgresFeatureFlagStore({ database: restartedDb }) });
  const after = await restarted.resolve('feature:postgres-rollout', context);
  assert.equal(after.enabled, before.enabled);
  assert.equal(after.bucket, before.bucket);
  assert.equal(after.percentage, 5000);
  assert.equal((await restarted.store.get('feature:postgres-rollout')).cohorts[0], 'pilot');
  await restartedDb.close();
});

integration('Block 16.16 disabling new use is durable and does not mutate existing durable work', async () => {
  const database = createPostgresDatabase({ connectionString, ssl: false, applicationName: 'sg-feature-disable-test' });
  await database.start();
  await runMigrations(database);
  await database.query('TRUNCATE feature_flags');
  await database.query("INSERT INTO users(global_user_id,profile) VALUES('flag-user','{}'::jsonb) ON CONFLICT(global_user_id) DO NOTHING");
  await database.query("INSERT INTO tasks(task_id,global_user_id,project_scope,status,payload,title,type) VALUES('existing-flag-task','flag-user','sg2.1','queued','{}'::jsonb,'existing','sg2.1') ON CONFLICT(task_id) DO NOTHING");

  const service = createFeatureFlagService({ store: createPostgresFeatureFlagStore({ database }) });
  await service.setFlag({ featureId: 'feature:new-task-path', enabled: true });
  const context = { globalUserId: 'flag-user', projectScope: 'sg2.1', permissionSatisfied: true, authoritySatisfied: true, actionGateSatisfied: true };
  assert.equal((await service.resolve('feature:new-task-path', context)).enabled, true);
  await service.setFlag({ featureId: 'feature:new-task-path', enabled: false });
  assert.equal((await service.resolve('feature:new-task-path', context)).enabled, false);
  const existing = await database.query("SELECT status,payload FROM tasks WHERE task_id='existing-flag-task'");
  assert.equal(existing.rows[0].status, 'queued');
  assert.deepEqual(existing.rows[0].payload, {});
  await database.close();
});
