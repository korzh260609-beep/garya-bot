// src/projectExperience/ProjectEvidenceSeedService.js
// ============================================================================
// STAGE C.9E — Project Evidence Seed Service (SKELETON / ADAPTER LAYER)
// Purpose:
// - prepare Project Memory evidence seed through injected adapters/deps
// - keep handleMessage/core free from GitHub connector details
// - keep ProjectGitHubEvidenceSource fetcher-injected
// IMPORTANT:
// - NO DB writes
// - NO Project Memory writes
// - NO direct GitHub connector import
// - NO pillar edits
// - fail-open: missing adapters or errors return empty seed + warning
// ============================================================================

import { ProjectGitHubEvidenceSource } from "./ProjectGitHubEvidenceSource.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function hasAnySeedData(seed = {}) {
  return Boolean(
    ensureArray(seed?.commits).length > 0 ||
    safeText(seed?.pillars?.roadmap) ||
    safeText(seed?.pillars?.workflow) ||
    safeText(seed?.pillars?.decisions) ||
    ensureArray(seed?.memoryEvidences).length > 0
  );
}

function emptySeed({
  projectKey = "garya-bot",
  repository = "korzh260609-beep/garya-bot",
  ref = "main",
  commitLimit = 5,
  warnings = [],
} = {}) {
  return {
    projectKey,
    repository,
    ref,
    commitLimit: clampNumber(commitLimit, 5, 1, 10),
    commits: [],
    pillars: {},
    memoryEvidences: [],
    source: "ProjectEvidenceSeedService",
    hasData: false,
    warnings: ensureArray(warnings),
    summary: {
      commits: 0,
      hasRoadmap: false,
      hasWorkflow: false,
      hasDecisions: false,
      memoryEvidences: 0,
    },
  };
}

export class ProjectEvidenceSeedService {
  constructor({
    projectKey = "garya-bot",
    repository = "korzh260609-beep/garya-bot",
    ref = "main",
    commitLimit = 5,
    fetchRecentCommits = null,
    fetchPillars = null,
  } = {}) {
    this.projectKey = projectKey;
    this.repository = repository;
    this.ref = ref;
    this.commitLimit = clampNumber(commitLimit, 5, 1, 10);
    this.fetchRecentCommits = typeof fetchRecentCommits === "function" ? fetchRecentCommits : null;
    this.fetchPillars = typeof fetchPillars === "function" ? fetchPillars : null;
  }

  canBuildSeed() {
    return Boolean(this.fetchRecentCommits || this.fetchPillars);
  }

  async buildSeed({
    projectKey = this.projectKey,
    repository = this.repository,
    ref = this.ref,
    commitLimit = this.commitLimit,
  } = {}) {
    const limit = clampNumber(commitLimit, this.commitLimit, 1, 10);

    if (!this.canBuildSeed()) {
      return emptySeed({
        projectKey,
        repository,
        ref,
        commitLimit: limit,
        warnings: [
          "ProjectEvidenceSeedService has no injected fetch adapters.",
          "No GitHub evidence seed was built.",
        ],
      });
    }

    try {
      const source = new ProjectGitHubEvidenceSource({
        repository,
        ref,
        commitLimit: limit,
        fetchRecentCommits: this.fetchRecentCommits,
        fetchPillars: this.fetchPillars,
      });

      const seed = await source.buildSeed({
        projectKey,
        repository,
        ref,
        commitLimit: limit,
      });

      return {
        ...seed,
        source: "ProjectEvidenceSeedService",
        upstreamSource: seed?.source || "ProjectGitHubEvidenceSource",
        hasData: hasAnySeedData(seed),
        warnings: ensureArray(seed?.warnings),
        summary: {
          ...(seed?.summary && typeof seed.summary === "object" ? seed.summary : {}),
          memoryEvidences: ensureArray(seed?.memoryEvidences).length,
        },
      };
    } catch (e) {
      return emptySeed({
        projectKey,
        repository,
        ref,
        commitLimit: limit,
        warnings: [`ProjectEvidenceSeedService failed: ${safeText(e?.message) || "unknown_error"}`],
      });
    }
  }
}

export default {
  ProjectEvidenceSeedService,
};
