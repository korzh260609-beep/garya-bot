// src/repoStateCollector/RepoStateCollectorService.js
// ============================================================================
// Repo State Collector Service (skeleton)
// Orchestrates read-only scan of repository state.
// ============================================================================

export class RepoStateCollectorService {
  constructor({ config, treeReader, moduleScanner, dependencyScanner, repository } = {}) {
    this.config = config;
    this.treeReader = treeReader;
    this.moduleScanner = moduleScanner;
    this.dependencyScanner = dependencyScanner;
    this.repository = repository;
  }

  async runScan() {
    // TODO: implement in next step
    return {
      ok: true,
      status: "not_implemented",
    };
  }
}

export default RepoStateCollectorService;
