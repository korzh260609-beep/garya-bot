export class RepoIndexStore {
  constructor({ db }) {
    this.db = db;
  }

  async saveSnapshot({ repo, branch, commitSha, stats, files }) {
    // TODO: insert into repo_index_snapshots
    // TODO: insert into repo_index_files
    // return snapshot_id
  }

  async getLatestSnapshot({ repo, branch }) {
    // TODO
  }

  async getTree({ snapshotId, prefix = "" }) {
    // TODO
  }
}
