// src/repoStateCollector/RepoStateCollectorService.js
// ============================================================================
// Repo State Collector Service
// Orchestrates read-only scan of repository state.
// ============================================================================

function nowIso() {
  return new Date().toISOString();
}

export class RepoStateCollectorService {
  constructor({ config, treeReader, moduleScanner, dependencyScanner, repository } = {}) {
    this.config = config || {};
    this.treeReader = treeReader;
    this.moduleScanner = moduleScanner;
    this.dependencyScanner = dependencyScanner;
    this.repository = repository;
  }

  async runScan() {
    if (!this.treeReader || typeof this.treeReader.readTree !== "function") {
      return {
        ok: false,
        error: "repo_state_collector_missing_tree_reader",
      };
    }

    if (!this.moduleScanner || typeof this.moduleScanner.scanModules !== "function") {
      return {
        ok: false,
        error: "repo_state_collector_missing_module_scanner",
      };
    }

    if (!this.dependencyScanner || typeof this.dependencyScanner.scanDependencies !== "function") {
      return {
        ok: false,
        error: "repo_state_collector_missing_dependency_scanner",
      };
    }

    const startedAt = nowIso();
    const treeResult = await this.treeReader.readTree();

    if (!treeResult?.ok) {
      return {
        ok: false,
        startedAt,
        finishedAt: nowIso(),
        stage: "read_tree",
        error: treeResult?.error || "repo_state_collector_tree_read_failed",
        tree: treeResult || null,
      };
    }

    const files = Array.isArray(treeResult.files) ? treeResult.files : [];
    const moduleResult = this.moduleScanner.scanModules(files);
    const dependencyResult = this.dependencyScanner.scanDependencies(files);
    const finishedAt = nowIso();

    const snapshot = {
      ok: Boolean(moduleResult?.ok && dependencyResult?.ok),
      status: "collected",
      startedAt,
      finishedAt,
      repoFullName: treeResult.repoFullName || this.config.repoFullName || null,
      branch: treeResult.branch || this.config.branch || null,
      filesCount: treeResult.filesCount || files.length,
      modulesCount: moduleResult?.modulesCount || 0,
      dependenciesCount: dependencyResult?.dependenciesCount || 0,
      tree: treeResult,
      modules: moduleResult?.modules || [],
      dependencies: dependencyResult?.dependencies || [],
      dependencyStats: {
        internalCount: dependencyResult?.internalCount || 0,
        externalCount: dependencyResult?.externalCount || 0,
        unresolvedInternalCount: dependencyResult?.unresolvedInternalCount || 0,
      },
      persisted: false,
    };

    if (this.repository && typeof this.repository.saveSnapshot === "function") {
      const saveResult = await this.repository.saveSnapshot(snapshot);
      snapshot.persisted = Boolean(saveResult?.saved);
      snapshot.persistence = saveResult;
    }

    return snapshot;
  }
}

export default RepoStateCollectorService;
