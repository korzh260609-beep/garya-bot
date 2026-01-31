// ============================================================================
// === src/repo/RepoIndexStore.js — PostgreSQL persistence for repo snapshots
// ============================================================================

export class RepoIndexStore {
  constructor({ pool }) {
    this.pool = pool;
  }

  /**
   * Save normalized snapshot (STRUCTURE ONLY, no content)
   */
  async saveSnapshot({ repo, branch, commitSha, stats, files }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const snapRes = await client.query(
        `
        INSERT INTO repo_index_snapshots (repo, branch, commit_sha, stats)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        `,
        [repo, branch, commitSha, stats || {}]
      );

      const snapshotId = snapRes.rows[0].id;

      for (const f of files) {
        await client.query(
          `
          INSERT INTO repo_index_files (snapshot_id, path, blob_sha, size)
          VALUES ($1, $2, $3, $4)
          `,
          [snapshotId, f.path, f.blobSha || null, f.size || 0]
        );
      }

      await client.query("COMMIT");
      return snapshotId;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get latest snapshot header
   */
  async getLatestSnapshot({ repo, branch }) {
    const res = await this.pool.query(
      `
      SELECT *
      FROM repo_index_snapshots
      WHERE repo = $1 AND branch = $2
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [repo, branch]
    );
    return res.rows[0] || null;
  }

  /**
   * Get repo tree from snapshot
   */
  async getTree({ snapshotId, prefix = "" }) {
    const res = await this.pool.query(
      `
      SELECT path, size, blob_sha
      FROM repo_index_files
      WHERE snapshot_id = $1
        AND path LIKE $2
      ORDER BY path
      `,
      [snapshotId, `${prefix}%`]
    );
    return res.rows;
  }
}
