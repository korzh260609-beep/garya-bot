import pkg from 'pg';
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('📦 PostgreSQL connected successfully.');
  } catch (err) {
    console.error('❌ PostgreSQL connection error:', err);
  }
})();
