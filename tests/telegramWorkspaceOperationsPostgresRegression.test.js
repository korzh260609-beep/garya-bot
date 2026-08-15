import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import { createPostgresTelegramWorkspaceOperationsStore } from '../src/telegramWorkspace/postgresWorkspaceOperationsStore.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('TWM 1.14/1.15 PostgreSQL records, events and analytics are workspace-isolated and durable', async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16);
  const workspaceA = `tgw_${suffix}a`;
  const workspaceB = `tgw_${suffix}b`;
  const recordId = `content_${suffix}`;
  let persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm-operations-regression' });
  await persistence.start();

  try {
    const now = new Date().toISOString();
    await persistence.database.query(`
      INSERT INTO telegram_workspaces(workspace_id,platform,telegram_chat_id,workspace_type,title,lifecycle_state,created_at,updated_at)
      VALUES
        ($1,'telegram',$3,'supergroup','TWM A','ACTIVE',$5,$5),
        ($2,'telegram',$4,'supergroup','TWM B','ACTIVE',$5,$5)
    `, [workspaceA, workspaceB, `-10${Date.now()}1`, `-10${Date.now()}2`, now]);

    let store = createPostgresTelegramWorkspaceOperationsStore(persistence.database);
    await store.createRecord({
      workspaceId: workspaceA,
      domain: 'content',
      recordId,
      status: 'draft',
      visibility: 'workspace',
      privacyClass: 'workspace',
      actorGlobalUserId: 'user:a',
      payload: { text: 'workspace A' },
      idempotencyKey: `idem:${suffix}`
    });
    await store.createRecord({
      workspaceId: workspaceB,
      domain: 'content',
      recordId,
      status: 'draft',
      visibility: 'workspace',
      privacyClass: 'workspace',
      actorGlobalUserId: 'user:b',
      payload: { text: 'workspace B' },
      idempotencyKey: `idem:${suffix}`
    });

    assert.equal((await store.getRecord({ workspaceId: workspaceA, domain: 'content', recordId })).payload.text, 'workspace A');
    assert.equal((await store.getRecord({ workspaceId: workspaceB, domain: 'content', recordId })).payload.text, 'workspace B');

    const duplicateA = await store.createRecord({
      workspaceId: workspaceA,
      domain: 'content',
      recordId: `different_${suffix}`,
      status: 'draft',
      visibility: 'workspace',
      privacyClass: 'workspace',
      actorGlobalUserId: 'user:a',
      payload: { text: 'must dedupe inside A' },
      idempotencyKey: `idem:${suffix}`
    });
    assert.equal(duplicateA.recordId, recordId);
    assert.equal(duplicateA.payload.text, 'workspace A');

    await store.appendEvent({
      workspaceId: workspaceA,
      eventKey: `event:${suffix}:a`,
      eventType: 'content.published',
      recordDomain: 'content',
      recordId,
      actorGlobalUserId: 'user:a',
      evidence: { telegramMessageId: 101 }
    });
    await store.appendEvent({
      workspaceId: workspaceB,
      eventKey: `event:${suffix}:b`,
      eventType: 'poll.statistics',
      recordDomain: 'content',
      recordId,
      actorGlobalUserId: 'user:b',
      evidence: { totalVoterCount: 3 }
    });

    assert.deepEqual(await store.aggregateEvents({ workspaceId: workspaceA }), { 'content.published': 1 });
    assert.deepEqual(await store.aggregateEvents({ workspaceId: workspaceB }), { 'poll.statistics': 1 });

    const snapshot = await store.saveAnalyticsSnapshot({
      workspaceId: workspaceA,
      snapshotId: `analytics_${suffix}`,
      metrics: { recordCounts: { content: 1 }, eventCounts: { 'content.published': 1 }, totalStructuredEvents: 1 }
    });
    assert.equal(snapshot.workspaceId, workspaceA);

    await persistence.close();
    persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm-operations-regression-restart' });
    await persistence.start();
    store = createPostgresTelegramWorkspaceOperationsStore(persistence.database);

    assert.equal((await store.getRecord({ workspaceId: workspaceA, domain: 'content', recordId })).payload.text, 'workspace A');
    assert.equal((await store.getRecord({ workspaceId: workspaceB, domain: 'content', recordId })).payload.text, 'workspace B');
    const persistedSnapshot = await persistence.database.query(
      'SELECT workspace_id, metrics FROM telegram_workspace_analytics_snapshots WHERE snapshot_id=$1',
      [`analytics_${suffix}`]
    );
    assert.equal(persistedSnapshot.rowCount, 1);
    assert.equal(persistedSnapshot.rows[0].workspace_id, workspaceA);
    assert.equal(persistedSnapshot.rows[0].metrics.totalStructuredEvents, 1);
  } finally {
    try {
      if (!persistence.health().started) await persistence.start();
      await persistence.database.query('DELETE FROM telegram_workspaces WHERE workspace_id = ANY($1::text[])', [[workspaceA, workspaceB]]);
    } finally {
      await persistence.close();
    }
  }
});
