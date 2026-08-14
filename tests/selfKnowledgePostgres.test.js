import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import { createPostgresSelfKnowledgeStore } from '../src/selfKnowledge/postgresSelfKnowledgeStore.js';
import { createSelfKnowledgeBuilder, createSelfKnowledgeService } from '../src/selfKnowledge/selfKnowledge.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

function source(revision, suffix) {
  return {
    id: 'postgres-evidence',
    async collect() {
      return { facts: [{ category: 'identity', key: `system-name-${suffix}`, value: 'SG', status: 'implemented', kind: 'authority', provenance: { sourceType: 'authority', sourceId: 'postgres-test', sourceRevision: revision } }] };
    }
  };
}

integration('Self Knowledge snapshots persist across restart and no-op rebuild does not duplicate state', async () => {
  const suffix = randomUUID();
  const environment = `test:${suffix}`;
  const revision = `revision:${suffix}`;
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-self-knowledge-test' });
  await persistence.start();
  const store = createPostgresSelfKnowledgeStore({ database: persistence.database });
  const builder = createSelfKnowledgeBuilder({ store, sources: [source(revision, suffix)] });
  const first = await builder.rebuild({ sourceRevision: revision, commitSha: revision, environment });
  assert.equal(first.status, 'written');
  assert.equal(first.snapshot.version, 1);
  const duplicate = await builder.rebuild({ sourceRevision: revision, commitSha: revision, environment });
  assert.equal(duplicate.status, 'duplicate');
  assert.equal(duplicate.snapshot.version, 1);
  await persistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-self-knowledge-restart-test' });
  await restarted.start();
  try {
    const restartedStore = createPostgresSelfKnowledgeStore({ database: restarted.database });
    const service = createSelfKnowledgeService({ store: restartedStore });
    const snapshot = await service.getSnapshot({ environment });
    assert.equal(snapshot.version, 1);
    assert.equal(snapshot.sourceRevision, revision);
    assert.equal(snapshot.facts[0].value, 'SG');
    const count = await restarted.database.query('SELECT count(*)::int AS count FROM system_self_knowledge_snapshots WHERE environment=$1', [environment]);
    assert.equal(count.rows[0].count, 1);
  } finally {
    await restarted.database.query('DELETE FROM system_self_knowledge_snapshots WHERE environment=$1', [environment]);
    await restarted.close();
  }
});
