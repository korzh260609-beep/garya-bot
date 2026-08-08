import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence, runMigrations } from '../src/persistence/index.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('Block 12 upgrades an SG 2.0 database in place without deleting legacy data', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg20-compat-test' });
  await persistence.start();
  const { database, repositories } = persistence;

  await database.query(`
    DROP TABLE IF EXISTS delivery_records, user_settings, conversation_sessions, conversation_topics, resource_authorities, managed_resources, external_connections, telegram_updates, dead_letter_tasks, schedule_occurrences, domain_records, observability_events,
      idempotency_records, execution_states, schedules, memory_records, messages, conversations,
      grants, roles, identity_links, tasks, users, schema_migrations CASCADE
  `);

  await database.query(`
    CREATE TABLE users (
      id serial PRIMARY KEY,
      chat_id text NOT NULL UNIQUE,
      tg_user_id text,
      name text,
      role text NOT NULL DEFAULT 'guest',
      global_user_id text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_users_global_user_id ON users(global_user_id);
    INSERT INTO users(chat_id,tg_user_id,name,role,global_user_id)
      VALUES ('42','42','Legacy Monarch','monarch','tg:42');

    CREATE TABLE tasks (
      id serial PRIMARY KEY,
      user_chat_id text NOT NULL,
      user_global_id text,
      title text NOT NULL,
      type text NOT NULL,
      payload jsonb NOT NULL,
      schedule text,
      status text NOT NULL DEFAULT 'active',
      last_run timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO tasks(user_chat_id,user_global_id,title,type,payload)
      VALUES ('42','tg:42','legacy task','legacy','{}'::jsonb);
  `);

  const migrated = await runMigrations(database);
  assert.equal(migrated.applied.length, 11);
  assert.equal(migrated.total, 11);
  assert.ok(migrated.applied.includes('165_temporal_context.sql'));
  assert.ok(migrated.applied.includes('166_recurring_schedules.sql'));
  assert.ok(migrated.applied.includes('169_external_connections.sql'));
  assert.ok(migrated.applied.includes('170_resource_authority.sql'));
  assert.ok(migrated.applied.includes('171_session_conversation_context.sql'));
  assert.ok(migrated.applied.includes('172_user_settings_preferences.sql'));
  assert.ok(migrated.applied.includes('173_delivery_router.sql'));

  const legacyUser = await database.query("SELECT chat_id,global_user_id FROM users WHERE global_user_id='tg:42'");
  assert.equal(legacyUser.rows[0].chat_id, '42');
  const legacyTask = await database.query("SELECT title,task_id,global_user_id FROM tasks WHERE title='legacy task'");
  assert.equal(legacyTask.rows[0].task_id, 'legacy:1');
  assert.equal(legacyTask.rows[0].global_user_id, 'tg:42');

  await repositories.users.upsert({ globalUserId: 'telegram:100', profile: { displayName: 'SG 2.1 user' } });
  const newUser = await database.query("SELECT global_user_id,chat_id FROM users WHERE global_user_id='telegram:100'");
  assert.equal(newUser.rows[0].global_user_id, 'telegram:100');
  assert.equal(newUser.rows[0].chat_id, null);

  await repositories.automation.putTask({ taskId: 'sg21:test-task', scope: { globalUserId: 'telegram:100', projectScope: 'sg2.1' }, status: 'queued', payload: { source: 'compat-test' } });
  const newTask = await database.query("SELECT task_id,title,type,user_chat_id FROM tasks WHERE task_id='sg21:test-task'");
  assert.equal(newTask.rows[0].title, 'SG 2.1 task');
  assert.equal(newTask.rows[0].type, 'sg2.1');
  assert.equal(newTask.rows[0].user_chat_id, null);

  const constraint = await database.query(`SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.confrelid WHERE t.relname='users' AND c.contype='f' LIMIT 1`);
  assert.ok(constraint.rowCount > 0);
  await persistence.close();
});

integration('Block 12 PostgreSQL persistence is durable, isolated and atomic', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-block12-test' });
  await persistence.start();
  const { database, repositories } = persistence;
  await database.query(`TRUNCATE delivery_records, user_settings, conversation_sessions, conversation_topics, resource_authorities, managed_resources, external_connections, schedule_occurrences, domain_records, observability_events, idempotency_records, execution_states, schedules, tasks, memory_records, messages, conversations, grants, roles, identity_links, users RESTART IDENTITY CASCADE`);

  const migrationRepeat = await runMigrations(database);
  assert.deepEqual(migrationRepeat.applied, []);
  assert.equal(migrationRepeat.total, 11);

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
