import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import { verifyBackupRestore } from '../src/operations/securityOperations.js';

const connectionString = process.env.DATABASE_URL;
const postgresIntegration = connectionString ? test : test.skip;

function fingerprint(rows) {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

postgresIntegration('Block 19: PostgreSQL recovery restores persisted rows exactly in an isolated verification table', async () => {
  const client = new pg.Client({ connectionString, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false });
  await client.connect();
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const table = `block19_recovery_${suffix}`;
  try {
    await client.query(`CREATE TABLE ${table} (id text PRIMARY KEY, payload jsonb NOT NULL, created_at timestamptz NOT NULL)`);
    await client.query(`INSERT INTO ${table}(id,payload,created_at) VALUES ($1,$2::jsonb,$3),($4,$5::jsonb,$6)`, [
      'record-a', JSON.stringify({ type: 'memory', state: 'confirmed' }), '2026-08-10T05:00:00.000Z',
      'record-b', JSON.stringify({ type: 'task', state: 'queued' }), '2026-08-10T05:01:00.000Z'
    ]);

    const result = await verifyBackupRestore({
      createBackup: async () => {
        const snapshot = await client.query(`SELECT id,payload,created_at FROM ${table} ORDER BY id`);
        return snapshot.rows.map((row) => ({ ...row, created_at: new Date(row.created_at).toISOString() }));
      },
      restoreBackup: async (backup) => {
        await client.query(`TRUNCATE ${table}`);
        for (const row of backup) {
          await client.query(`INSERT INTO ${table}(id,payload,created_at) VALUES ($1,$2::jsonb,$3)`, [row.id, JSON.stringify(row.payload), row.created_at]);
        }
        const restored = await client.query(`SELECT id,payload,created_at FROM ${table} ORDER BY id`);
        return restored.rows.map((row) => ({ ...row, created_at: new Date(row.created_at).toISOString() }));
      },
      fingerprint: async (rows) => fingerprint(rows)
    });

    assert.equal(result.verified, true);
    assert.equal(result.before, result.after);
    const count = await client.query(`SELECT count(*)::int AS count FROM ${table}`);
    assert.equal(count.rows[0].count, 2);
  } finally {
    await client.query(`DROP TABLE IF EXISTS ${table}`);
    await client.end();
  }
});
