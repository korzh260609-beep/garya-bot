import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence, runMigrations } from '../src/persistence/index.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('Block 12 PostgreSQL persistence is durable, isolated and atomic', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-block12-test' });
  await persistence.start();
  const { database, repositories } = persistence;
  await database.query(`TRUNCATE domain_records, observability_events, idempotency_records, execution_states, schedules, tasks, memory_records, messages, conversations, grants, roles, identity_links, users RESTART IDENTITY CASCADE`);

  const migrationRepeat = await runMigrations(database);
  assert.deepEqual(migrationRepeat.applied, []);
  assert.equal(migrationRepeat.total, 1);

  const suffix = randomUUID();
  const scope = { globalUserId: `user:${suffix}`, projectScope: 'sg2.1', groupScope: 'group:1', threadScope: 'thread:1' };
  const otherScope = { ...scope, globalUserId: `other:${suffix}` };

  await repositories.users.upsert({ globalUserId: scope.globalUserId, profile: { displayName: 'Gary' } });
  await repositories.identities.link({ platform: 'telegram', platformUserId: `tg:${suffix}`, globalUserId: scope.globalUserId });
  await repositories.access.grantRole({ globalUserId: scope.globalUserId, projectScope: scope.projectScope, role: 'monarch' });
  await repositories.access.grantPermission({ globalUserId: scope.globalUserId, projectScope: scope.projectScope, grantName: 'capability:compose-answer' });
  await repositories.conversations.upsert({ conversationId: `conversation:${suffix}`, scope, metadata: { transport: 'telegram' } });
  await repositories.conversations.appendMessage({ messageId: `message:${suffix}`, conversationId: `conversation:${suffix}`, scope, direction: 'inbound', content: { text: 'persist me' }, provenance: { updateId: suffix } });
  await repositories.memory.put({ memoryId: `memory:${suffix}`, scope, layer: 'user-memory', key: 'preference', value: { concise: true }, provenance: { sourceType: 'user', sourceId: suffix, actorId: scope.globalUserId }, trust: 'confirmed', confirmed: true, tags: ['profile'] });
  await repositories.automation.putTask({ taskId: `task:${suffix}`, scope, status: 'queued', payload: { action: 'verify' } });
  await repositories.automation.putSchedule({ scheduleId: `schedule:${suffix}`, taskId: `task:${suffix}`, dueAt: new Date(Date.now() + 60000).toISOString() });
  await repositories.automation.putExecution({ executionId: `execution:${suffix}`, taskId: `task:${suffix}`, status: 'pending' });
  assert.ok(await repositories.idempotency.reserve({ key: `idem:${suffix}`, scope, actionFingerprint: 'verify:v1' }));
  assert.equal(await repositories.idempotency.reserve({ key: `idem:${suffix}`, scope, actionFingerprint: 'verify:v1' }), null);
  await repositories.idempotency.complete({ key: `idem:${suffix}`, result: { ok: true } });
  await repositories.observability.record({ channel: 'audit', eventClass: 'protected_action', traceId: suffix, globalUserId: scope.globalUserId, projectScope: scope.projectScope, payload: { token: 'must-not-persist', nested: { password: 'hidden', safe: true } } });
  await repositories.domains.put({ domainId: 'test-domain', recordId: `record:${suffix}`, scope, payload: { value: 1 } });

  assert.equal((await repositories.conversations.listMessages({ conversationId: `conversation:${suffix}`, scope: otherScope })).length, 0);
  assert.equal((await repositories.memory.list({ scope: otherScope, layers: ['user-memory'] })).length, 0);
  await assert.rejects(() => repositories.identities.link({ platform: 'telegram', platformUserId: `tg:${suffix}`, globalUserId: otherScope.globalUserId }), /another global user/);

  const rollbackUser = `rollback:${suffix}`;
  await assert.rejects(() => repositories.protectedTransaction(async (repos, tx) => {
    await repos.users.upsert({ globalUserId: rollbackUser }, tx);
    await repos.automation.putTask({ taskId: `rollback-task:${suffix}`, scope: { globalUserId: rollbackUser, projectScope: 'sg2.1' }, status: 'queued', payload: {} }, tx);
    throw new Error('force rollback');
  }), /force rollback/);
  assert.equal(await repositories.users.get(rollbackUser), null);

  const redacted = await database.query('SELECT payload FROM observability_events WHERE trace_id=$1', [suffix]);
  assert.equal(redacted.rows[0].payload.token, '[REDACTED]');
  assert.equal(redacted.rows[0].payload.nested.password, '[REDACTED]');
  assert.equal(redacted.rows[0].payload.nested.safe, true);

  await persistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-block12-restart-test' });
  await restarted.start();
  assert.equal((await restarted.repositories.users.get(scope.globalUserId)).profile.displayName, 'Gary');
  assert.equal((await restarted.repositories.identities.resolve('telegram', `tg:${suffix}`)).global_user_id, scope.globalUserId);
  assert.deepEqual((await restarted.repositories.access.list({ globalUserId: scope.globalUserId, projectScope: scope.projectScope })).roles, ['monarch']);
  assert.equal((await restarted.repositories.conversations.listMessages({ conversationId: `conversation:${suffix}`, scope })).length, 1);
  assert.equal((await restarted.repositories.memory.list({ scope, layers: ['user-memory'] })).length, 1);
  assert.equal((await restarted.database.query('SELECT count(*)::int AS count FROM tasks WHERE task_id=$1', [`task:${suffix}`])).rows[0].count, 1);
  assert.equal((await restarted.database.query('SELECT count(*)::int AS count FROM domain_records WHERE domain_id=$1 AND record_id=$2', ['test-domain', `record:${suffix}`])).rows[0].count, 1);
  await restarted.close();
});
