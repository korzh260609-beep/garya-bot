// src/projectExperience/ProjectLightEvidencePackBuilder.js
// ============================================================================
// STAGE C.9A — Project Light Evidence Pack Builder (SKELETON / LIGHT MODE)
// Purpose:
// - build a small Project Memory evidence pack through ProjectEvidenceProvider
// - keep handleChatFlow free from GitHub/pillars fetching
// - accept already-fetched commits/pillars/memory evidences from caller/session layer
// IMPORTANT:
// - NO DB writes
// - NO Project Memory writes
// - NO GitHub calls inside this file
// - NO pillar edits
// ============================================================================

import { ProjectEvidenceProvider } from "./ProjectEvidenceProvider.js";

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

function sliceRecent(items = [], limit = 5) {
  return ensureArray(items).slice(0, clampNumber(limit, 5, 1, 10));
}

export class ProjectLightEvidencePackBuilder {
  constructor({
    projectKey = "garya-bot",
    repository = "korzh260609-beep/garya-bot",
    ref = "main",
    commitLimit = 5,
    provider = null,
  } = {}) {
    this.projectKey = projectKey;
    this.repository = repository;
    this.ref = ref;
    this.commitLimit = clampNumber(commitLimit, 5, 1, 10);
    this.provider = provider || new ProjectEvidenceProvider({ projectKey, repository, ref });
  }

  build({
    commits = [],
    pillars = {},
    memoryEvidences = [],
    commitLimit = this.commitLimit,
  } = {}) {
    const selectedCommits = sliceRecent(commits, commitLimit);

    const evidencePack = this.provider.buildEvidencePack({
      commits: selectedCommits,
      pillars: {
        roadmap: safeText(pillars?.roadmap),
        workflow: safeText(pillars?.workflow),
        decisions: safeText(pillars?.decisions),
      },
      memoryEvidences: ensureArray(memoryEvidences),
    });

    return {
      ...evidencePack,
      lightMode: true,
      source: "ProjectLightEvidencePackBuilder",
      limits: {
        commitLimit: selectedCommits.length,
        maxCommitLimit: 10,
      },
      warnings: [
        ...ensureArray(evidencePack?.warnings),
        selectedCommits.length === 0 ? "No commits supplied to light evidence builder." : null,
      ].filter(Boolean),
    };
  }
}

export function buildProjectLightEvidencePack(input = {}) {
  return new ProjectLightEvidencePackBuilder(input).build(input);
}

export default {
  ProjectLightEvidencePackBuilder,
  buildProjectLightEvidencePack,
};
