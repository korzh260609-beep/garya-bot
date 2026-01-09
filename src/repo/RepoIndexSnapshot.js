// ============================================================================
// === src/repo/RepoIndexSnapshot.js — NORMALIZED INDEX SNAPSHOT (SKELETON)
// ============================================================================

export class RepoIndexSnapshot {
  constructor({ repo, branch }) {
    this.repo = repo;
    this.branch = branch;
    this.createdAt = new Date().toISOString();

    this.stats = {
      filesListed: 0,
      filesFetched: 0,
      filesSkipped: 0,
    };

    // нормализованное хранилище
    this.files = []; // [{ path, size, hash?, content? }]
  }

  addFile({ path, content }) {
    this.files.push({
      path,
      size: content ? content.length : 0,
      content: content || null,
    });
  }

  finalize({ filesListed, filesFetched, filesSkipped }) {
    this.stats.filesListed = filesListed;
    this.stats.filesFetched = filesFetched;
    this.stats.filesSkipped = filesSkipped;
  }
}

