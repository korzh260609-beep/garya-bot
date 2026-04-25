// src/projectExperience/ProjectGitHubEvidenceSource.js
// ============================================================================
// STAGE C.9C — Project GitHub Evidence Source (SKELETON / FETCHER-INJECTED)
// Purpose:
// - prepare light GitHub commit/pillar seed for ProjectLightEvidencePackBuilder
// - keep GitHub API implementation outside core logic
// - allow runtime to inject fetchers/adapters safely
// IMPORTANT:
// - NO DB writes
// - NO Project Memory writes
// - NO direct GitHub connector import here
// - NO pillar edits
// - fail-open: source errors return empty seed + warning
// ============================================================================

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

function normalizePillars(pillars = {}) {
  return {
    roadmap: safeText(pillars?.roadmap),
    workflow: safeText(pillars?.workflow),
    decisions: safeText(pillars?.decisions),
  };
}

export class ProjectGitHubEvidenceSource {
  constructor({
    repository = "korzh260609-beep/garya-bot",
    ref = "main",
    commitLimit = 5,
    fetchRecentCommits = null,
    fetchPillars = null,
  } = {}) {
    this.repository = repository;
    this.ref = ref;
    this.commitLimit = clampNumber(commitLimit, 5, 1, 10);
    this.fetchRecentCommits = typeof fetchRecentCommits === "function" ? fetchRecentCommits : null;
    this.fetchPillars = typeof fetchPillars === "function" ? fetchPillars : null;
  }

  async buildSeed({
    projectKey = "garya-bot",
    repository = this.repository,
    ref = this.ref,
    commitLimit = this.commitLimit,
  } = {}) {
    const limit = clampNumber(commitLimit, this.commitLimit, 1, 10);
    const warnings = [];
    let commits = [];
    let pillars = {};

    try {
      if (this.fetchRecentCommits) {
        commits = ensureArray(await this.fetchRecentCommits({ repository, ref, limit })).slice(0, limit);
      } else {
        warnings.push("fetchRecentCommits adapter not supplied");
      }
    } catch (e) {
      warnings.push(`fetchRecentCommits failed: ${safeText(e?.message) || "unknown_error"}`);
      commits = [];
    }

    try {
      if (this.fetchPillars) {
        pillars = normalizePillars(await this.fetchPillars({ repository, ref }));
      } else {
        warnings.push("fetchPillars adapter not supplied");
      }
    } catch (e) {
      warnings.push(`fetchPillars failed: ${safeText(e?.message) || "unknown_error"}`);
      pillars = {};
    }

    return {
      projectKey,
      repository,
      ref,
      commitLimit: limit,
      commits,
      pillars: normalizePillars(pillars),
      memoryEvidences: [],
      source: "ProjectGitHubEvidenceSource",
      warnings,
      summary: {
        commits: commits.length,
        hasRoadmap: Boolean(safeText(pillars?.roadmap)),
        hasWorkflow: Boolean(safeText(pillars?.workflow)),
        hasDecisions: Boolean(safeText(pillars?.decisions)),
      },
    };
  }
}

export default {
  ProjectGitHubEvidenceSource,
};
