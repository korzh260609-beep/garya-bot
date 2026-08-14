import pg from 'pg';

const { Pool } = pg;

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

export function createPostgresDatabase({ connectionString, ssl = false, max = 10, connectionTimeoutMillis = 5000, idleTimeoutMillis = 30000, applicationName = 'sg-2-1' } = {}) {
  const url = required(connectionString, 'connectionString');
  const pool = new Pool({
    connectionString: url,
    ssl: ssl ? { rejectUnauthorized: false } : false,
    max,
    connectionTimeoutMillis,
    idleTimeoutMillis,
    application_name: applicationName
  });
  let started = false;

  async function start() {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1 AS ready');
      started = true;
    } finally {
      client.release();
    }
  }

  async function query(text, values = []) {
    if (!started) throw new Error('postgres database is not started');
    return pool.query(text, values);
  }

  async function transaction(work, { isolationLevel = 'READ COMMITTED' } = {}) {
    if (!started) throw new Error('postgres database is not started');
    if (typeof work !== 'function') throw new TypeError('transaction work must be a function');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      const tx = Object.freeze({ query: (text, values = []) => client.query(text, values) });
      const result = await work(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  async function close() {
    started = false;
    await pool.end();
  }

  return Object.freeze({ start, query, transaction, close, health: () => ({ started, total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount }) });
}
