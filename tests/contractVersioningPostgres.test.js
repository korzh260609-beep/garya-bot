import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence, runMigrations } from '../src/persistence/index.js';
import { createPostgresContractQuarantineStore } from '../src/contracts/postgresContractQuarantineStore.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('Block 16.15 PostgreSQL quarantine persists unsupported contract records and filters them deterministically', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-block16-15-quarantine-test' });
  await persistence.start();
  await runMigrations(persistence.database);

  const store = createPostgresContractQuarantineStore(persistence.database);
  const suffix = randomUUID();
  const quarantineId = `contract-quarantine:${suffix}`;
  const record = {
    quarantineId,
    contractName: 'task-payload',
    version: '2.0',
    reason: 'contract-version-unsupported',
    source: 'queued-task-replay',
    traceContext: { traceId: `trace:${suffix}`, requestId: `request:${suffix}` },
    record: { version: '2.0', taskId: `task:${suffix}`, projectScope: 'sg2.1' },
    quarantinedAt: '2026-08-08T18:00:00.000Z',
    status: 'quarantined'
  };

  const persisted = await store.quarantine(record);
  assert.equal(persisted.quarantineId, quarantineId);
  assert.equal(persisted.contractName, 'task-payload');
  assert.equal(persisted.version, '2.0');
  assert.deepEqual(persisted.record, record.record);

  const loaded = await store.get(quarantineId);
  assert.equal(loaded.reason, 'contract-version-unsupported');
  assert.equal(loaded.source, 'queued-task-replay');
  assert.deepEqual(loaded.traceContext, record.traceContext);

  const matching = await store.list({ status: 'quarantined', contractName: 'task-payload', limit: 100 });
  assert.ok(matching.some((entry) => entry.quarantineId === quarantineId));
  const wrongContract = await store.list({ status: 'quarantined', contractName: 'internal-event', limit: 100 });
  assert.ok(!wrongContract.some((entry) => entry.quarantineId === quarantineId));

  await persistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-block16-15-quarantine-restart-test' });
  await restarted.start();
  const restartedStore = createPostgresContractQuarantineStore(restarted.database);
  const afterRestart = await restartedStore.get(quarantineId);
  assert.equal(afterRestart.quarantineId, quarantineId);
  assert.deepEqual(afterRestart.record, record.record);
  await restarted.database.query('DELETE FROM contract_quarantine WHERE quarantine_id=$1', [quarantineId]);
  await restarted.close();
});
