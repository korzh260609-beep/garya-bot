import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function runMigrations(database, { directory = defaultDirectory } = {}) {
  await database.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  const files = (await readdir(directory)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
  const applied = [];
  for (const file of files) {
    const sql = await readFile(path.join(directory, file), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const current = await database.query('SELECT checksum FROM schema_migrations WHERE version = $1', [file]);
    if (current.rowCount > 0) {
      if (current.rows[0].checksum !== checksum) throw new Error(`migration checksum mismatch: ${file}`);
      continue;
    }
    await database.transaction(async (tx) => {
      await tx.query(sql);
      await tx.query('INSERT INTO schema_migrations(version, checksum) VALUES ($1, $2)', [file, checksum]);
    });
    applied.push(file);
  }
  return Object.freeze({ applied, total: files.length });
}
