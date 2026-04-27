// src/repoStateCollector/RepoStateCollectorFactory.js
// ============================================================================
// Repo State Collector Factory
// Builds ready-to-use collector instance with all dependencies.
// ============================================================================

import pool from "../../db.js";
import { getRepoStateConfig } from "./RepoStateConfig.js";
import RepoTreeReader from "./RepoTreeReader.js";
import RepoModuleScanner from "./RepoModuleScanner.js";
import RepoDependencyScanner from "./RepoDependencyScanner.js";
import RepoStateRepository from "./RepoStateRepository.js";
import RepoStateCollectorService from "./RepoStateCollectorService.js";
import RepoStateGitHubClient from "./RepoStateGitHubClient.js";

export function createRepoStateCollector({ githubClient } = {}) {
  const config = getRepoStateConfig();

  const resolvedGithubClient =
    githubClient ||
    new RepoStateGitHubClient({
      token: config.githubToken,
      apiBaseUrl: config.githubApiBaseUrl,
    });

  const treeReader = new RepoTreeReader({
    githubClient: resolvedGithubClient,
    config,
  });

  const moduleScanner = new RepoModuleScanner();
  const dependencyScanner = new RepoDependencyScanner();

  const repository = new RepoStateRepository({
    pool,
  });

  const collector = new RepoStateCollectorService({
    config,
    treeReader,
    moduleScanner,
    dependencyScanner,
    repository,
  });

  return {
    collector,
    config,
    githubClient: resolvedGithubClient,
  };
}

export default {
  createRepoStateCollector,
};
