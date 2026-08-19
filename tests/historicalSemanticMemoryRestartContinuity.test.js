import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresDatabase } from '../src/persistence/database.js';
import { createPostgresMemory2Store } from '../src/memory2/postgresMemory2Store.js';
import { createMemory2Service } from '../src/memory2/memory2.js';

const databaseUrl = process.env.DATABASE_URL;

function scope() {
  return { userScope: 'hs6-restart-user', globalUserId: 'hs6-restart-user', projectScope: 'sg2.1', groupScope: null, threadScope: null };
}

function actor() {
  return { globalUserId: 'hs6-restart-user', roles: ['citizen'], grants: [], authenticationLevel: 'verified' };
}

test('HS6: PostgreSQL Memory 2.0 evidence survives database client restart and remains recallable', { skip: !databaseUrl }, async () => {
  const memoryId = `hs6-restart-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const key = `hs6-restart-key-${memoryId}`;
  const value = 'durable historical evidence across process restart';

  const firstDatabase = createPostgresDatabase({ connectionString: databaseUrl, ssl: false, applicationName: 'hs6-restart-write' });
  await firstDatabase.start();
  try {
    const firstService = createMemory2Service({
      store: createPostgresMemory2Store({ database: firstDatabase }),
      clock: () => new Date('2026-08-19T12:00:00.000Z')
    });
    await firstService.write({
      id: memoryId,
      key,
      value,
      scope: scope(),
      actor: actor(),
      confirmed: true,
      trust: 'confirmed',
      provenance: { sourceType: 'test', sourceId: memoryId, sourceTimestamp: '2025-08-19T12:00:00.000Z' }
    });
  } finally {
    await firstDatabase.close();
  }

  const secondDatabase = createPostgresDatabase({ connectionString: databaseUrl, ssl: false, applicationName: 'hs6-restart-read' });
  await secondDatabase.start();
  try {
    const secondService = createMemory2Service({
      store: createPostgresMemory2Store({ database: secondDatabase }),
      clock: () => new Date('2026-08-19T12:01:00.000Z')
    });
    const recalled = await secondService.recall({
      scope: scope(),
      actor: actor(),
      query: 'durable historical evidence',
      includeHistory: true,
      maxRecords: 20,
      maxCharacters: 5000
    });
    const restored = recalled.records.find((record) => record.id === memoryId);
    assert.ok(restored, 'persisted memory must be recallable after database client restart');
    assert.equal(restored.value, value);
    assert.equal(restored.confirmed, true);
    assert.equal(restored.provenance.sourceTimestamp, '2025-08-19T12:00:00.000Z');
  } finally {
    await secondDatabase.query('DELETE FROM memory_records WHERE memory_id=$1', [memoryId]);
    await secondDatabase.close();
  }
});
