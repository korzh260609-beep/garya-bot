import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import { createPostgresMemory2Store } from '../src/memory2/postgresMemory2Store.js';
import { createMemory2Service } from '../src/memory2/memory2.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

function scope(user, project, groupScope = null, threadScope = null) { return { userScope: user, projectScope: project, groupScope, threadScope }; }
function actor(id, roles = ['citizen'], grants = []) { return { globalUserId: id, roles, grants, authenticationLevel: 'verified' }; }

integration('Memory 2.0 PostgreSQL shared memory survives restart without fake owner and remains group isolated', async () => {
  const suffix = randomUUID();
  const project = `memory2:${suffix}`;
  const first = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-memory2-test' });
  await first.start();
  const service = createMemory2Service({ store: createPostgresMemory2Store({ database: first.database }) });
  const written = await service.write({ key: 'shared-rule', value: 'same-group-only', scope: scope(`usr_${suffix}`.slice(0,20), project, 'g1'), actor: actor(`usr_${suffix}`.slice(0,20), ['manager']), scopeKind: 'group', shared: true, confirmed: true });
  assert.equal(written.record.memoryScope.ownerGlobalUserId, null);
  const raw = await first.database.query('SELECT global_user_id,owner_global_user_id,scope_kind,privacy_class FROM memory_records WHERE memory_id=$1', [written.record.id]);
  assert.equal(raw.rows[0].global_user_id, null);
  assert.equal(raw.rows[0].owner_global_user_id, null);
  assert.equal(raw.rows[0].scope_kind, 'group');
  assert.equal(raw.rows[0].privacy_class, 'group');
  await first.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-memory2-restart-test' });
  await restarted.start();
  try {
    const restartedService = createMemory2Service({ store: createPostgresMemory2Store({ database: restarted.database }) });
    const sameGroup = await restartedService.recall({ scope: scope('usr_member', project, 'g1'), actor: actor('usr_member'), query: 'shared rule' });
    const otherGroup = await restartedService.recall({ scope: scope('usr_member', project, 'g2'), actor: actor('usr_member'), query: 'shared rule' });
    assert.equal(sameGroup.records.length, 1);
    assert.equal(sameGroup.records[0].value, 'same-group-only');
    assert.equal(otherGroup.records.length, 0);
  } finally {
    await restarted.database.query('DELETE FROM memory_records WHERE project_scope=$1', [project]);
    await restarted.close();
  }
});

integration('Memory 2.0 migration keeps legacy repository writes valid and maps them to personal user-group memory', async () => {
  const suffix = randomUUID();
  const project = `memory2-legacy:${suffix}`;
  const user = `usr_${suffix.replaceAll('-','').slice(0,16)}`;
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-memory2-legacy-test' });
  await persistence.start();
  try {
    const row = await persistence.repositories.memory.put({
      memoryId: `legacy:${suffix}`,
      scope: { globalUserId: user, projectScope: project, groupScope: 'legacy-group', threadScope: null },
      layer: 'user-memory', key: 'legacy-key', value: 'legacy-value',
      provenance: { sourceType: 'legacy-test', sourceId: suffix, actorId: user }, trust: 'confirmed', confirmed: true, tags: []
    });
    const upgraded = await persistence.database.query('SELECT owner_global_user_id,scope_kind,privacy_class,confirmation_state,lifecycle_state,semantic_fingerprint FROM memory_records WHERE memory_id=$1', [row.memory_id]);
    assert.equal(upgraded.rows[0].owner_global_user_id, user);
    assert.equal(upgraded.rows[0].scope_kind, 'user-group');
    assert.equal(upgraded.rows[0].privacy_class, 'user-group');
    assert.equal(upgraded.rows[0].confirmation_state, 'confirmed');
    assert.equal(upgraded.rows[0].lifecycle_state, 'active');
    assert.ok(upgraded.rows[0].semantic_fingerprint);
  } finally {
    await persistence.database.query('DELETE FROM memory_records WHERE project_scope=$1', [project]);
    await persistence.database.query('DELETE FROM users WHERE global_user_id=$1', [user]);
    await persistence.close();
  }
});

integration('Memory 2.0 PostgreSQL serializes concurrent duplicate writes and lifecycle reconciliation survives restart', async () => {
  const suffix = randomUUID();
  const project = `memory2-concurrency:${suffix}`;
  const user = `usr_${suffix.replaceAll('-','').slice(0,16)}`;
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-memory2-concurrency-test' });
  await persistence.start();
  await persistence.repositories.users.upsert({ globalUserId: user });
  const clock1 = () => new Date('2026-08-09T08:00:00.000Z');
  const service = createMemory2Service({ store: createPostgresMemory2Store({ database: persistence.database }), clock: clock1 });
  const request = { key: 'concurrent', value: 'one-copy', scope: scope(user, project), actor: actor(user), confirmed: true, provenance: { sourceType: 'test', sourceId: suffix } };
  const results = await Promise.all([service.write(request), service.write(request), service.write(request)]);
  assert.equal(new Set(results.map((item) => item.record.id)).size, 1);
  const count = await persistence.database.query('SELECT count(*)::int AS count FROM memory_records WHERE project_scope=$1 AND memory_key=$2', [project, 'concurrent']);
  assert.equal(count.rows[0].count, 1);

  const temporary = await service.write({ key: 'temporary', value: 'expires', scope: scope(user, project), actor: actor(user), confirmed: false, temporary: true, expiresAt: '2026-08-09T09:00:00.000Z' });
  await persistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-memory2-concurrency-restart-test' });
  await restarted.start();
  try {
    const clock2 = () => new Date('2026-08-09T10:00:00.000Z');
    const restartedService = createMemory2Service({ store: createPostgresMemory2Store({ database: restarted.database }), clock: clock2 });
    assert.deepEqual(await restartedService.reconcileLifecycle({ projectScope: project }), { expired: 1 });
    const row = await restarted.database.query('SELECT lifecycle_state FROM memory_records WHERE memory_id=$1', [temporary.record.id]);
    assert.equal(row.rows[0].lifecycle_state, 'expired');
    const recall = await restartedService.recall({ scope: scope(user, project), actor: actor(user), query: 'temporary' });
    assert.equal(recall.records.some((record) => record.id === temporary.record.id || record.key === 'temporary'), false);
  } finally {
    await restarted.database.query('DELETE FROM memory_records WHERE project_scope=$1', [project]);
    await restarted.database.query('DELETE FROM users WHERE global_user_id=$1', [user]);
    await restarted.close();
  }
});
