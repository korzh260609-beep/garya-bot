import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import { createPostgresTelegramWorkspaceOperationsStore } from '../src/telegramWorkspace/postgresWorkspaceOperationsStore.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('TWM1.15 PostgreSQL analytics filters records/events by window and counts unique persisted actors', async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16);
  const workspaceId = `tgw_analytics_${suffix}`;
  const oldRecordId = `content_old_${suffix}`;
  const currentRecordId = `content_now_${suffix}`;
  const pollRecordId = `poll_${suffix}`;
  const from = '2026-08-15T00:00:00.000Z';
  const to = '2026-08-16T00:00:00.000Z';
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm-analytics-regression' });
  await persistence.start();

  try {
    await persistence.database.query(`
      INSERT INTO telegram_workspaces(workspace_id,platform,telegram_chat_id,workspace_type,title,lifecycle_state,created_at,updated_at)
      VALUES($1,'telegram',$2,'supergroup','Analytics test','ACTIVE',$3,$3)
    `, [workspaceId, `-10${Date.now()}`, from]);

    const store = createPostgresTelegramWorkspaceOperationsStore(persistence.database);
    await store.createRecord({ workspaceId, domain: 'content', recordId: oldRecordId, status: 'published', visibility: 'workspace', privacyClass: 'workspace', actorGlobalUserId: 'user:owner', payload: {} });
    await store.createRecord({ workspaceId, domain: 'content', recordId: currentRecordId, status: 'published', visibility: 'workspace', privacyClass: 'workspace', actorGlobalUserId: 'user:owner', payload: {} });
    await store.createRecord({ workspaceId, domain: 'poll', recordId: pollRecordId, status: 'active', visibility: 'workspace', privacyClass: 'workspace', actorGlobalUserId: 'user:owner', payload: {} });

    await persistence.database.query(
      `UPDATE telegram_workspace_domain_records
       SET created_at = CASE record_id WHEN $2 THEN $4::timestamptz ELSE $5::timestamptz END,
           updated_at = CASE record_id WHEN $2 THEN $4::timestamptz ELSE $5::timestamptz END
       WHERE workspace_id=$1 AND record_id = ANY($3::text[])`,
      [workspaceId, oldRecordId, [oldRecordId, currentRecordId, pollRecordId], '2026-08-14T12:00:00.000Z', '2026-08-15T12:00:00.000Z']
    );

    assert.equal(await store.countRecords({ workspaceId, domain: 'content', from, to }), 1);
    assert.equal(await store.countRecords({ workspaceId, domain: 'poll', from, to }), 1);
    assert.equal(await store.countRecords({ workspaceId, domain: 'content' }), 2);

    await store.appendEvent({ workspaceId, eventKey: `old:${suffix}`, eventType: 'poll.answer-update', recordDomain: 'poll', recordId: pollRecordId, actorGlobalUserId: 'user:old', occurredAt: '2026-08-14T12:00:00.000Z' });
    await store.appendEvent({ workspaceId, eventKey: `a1:${suffix}`, eventType: 'poll.answer-update', recordDomain: 'poll', recordId: pollRecordId, actorGlobalUserId: 'user:a', occurredAt: '2026-08-15T10:00:00.000Z' });
    await store.appendEvent({ workspaceId, eventKey: `a2:${suffix}`, eventType: 'test.completed', recordDomain: 'test', recordId: `test_${suffix}`, actorGlobalUserId: 'user:a', occurredAt: '2026-08-15T11:00:00.000Z' });
    await store.appendEvent({ workspaceId, eventKey: `b1:${suffix}`, eventType: 'test.completed', recordDomain: 'test', recordId: `test_${suffix}`, actorGlobalUserId: 'user:b', occurredAt: '2026-08-15T12:00:00.000Z' });
    await store.appendEvent({ workspaceId, eventKey: `owner:${suffix}`, eventType: 'content.published', recordDomain: 'content', recordId: currentRecordId, actorGlobalUserId: 'user:owner', occurredAt: '2026-08-15T13:00:00.000Z' });

    assert.deepEqual(await store.aggregateEvents({ workspaceId, from, to }), {
      'content.published': 1,
      'poll.answer-update': 1,
      'test.completed': 2
    });
    assert.deepEqual(await store.aggregateEventActors({ workspaceId, eventTypes: ['poll.answer-update','test.completed'], from, to }), {
      uniqueActors: 2,
      interactionEvents: 3
    });
  } finally {
    try { await persistence.database.query('DELETE FROM telegram_workspaces WHERE workspace_id=$1', [workspaceId]); }
    finally { await persistence.close(); }
  }
});
