// src/projectExperience/ProjectEvidenceProvider.js
// ============================================================================
// STAGE C.8A — Project Evidence Provider (SKELETON / SOURCE COMPOSITION)
// Purpose:
// - provide real evidence inputs for ProjectClaimVerifier / AutoCapture
// - combine repo commits, diff analysis, pillars and memory evidence
// - keep data fetching/injection outside verifier logic
// IMPORTANT:
// - NO DB writes
// - NO Project Memory writes
// - NO GitHub calls inside this skeleton; caller supplies raw commits/pillar text
// - source-first, transport-agnostic
// ============================================================================

import { GitCommitCollector } from "./GitCommitCollector.js";
import { DiffAnalyzer } from "./DiffAnalyzer.js";
import { PillarsContextReader } from "./PillarsContextReader.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export class ProjectEvidenceProvider {
  constructor({
    projectKey = "garya-bot",
    repository = "korzh260609-beep/garya-bot",
    ref = "main",
  } = {}) {
    this.projectKey = projectKey;
    this.repository = repository;
    this.ref = ref;
    this.commitCollector = new GitCommitCollector({ repository, ref });
    this.diffAnalyzer = new DiffAnalyzer();
    this.pillarsReader = new PillarsContextReader();
  }

  buildEvidencePack({
    commits = [],
    pillars = {},
    memoryEvidences = [],
  } = {}) {
    const repoCommitEvidences = this.commitCollector.commitsToEvidences(commits);
    const diffEvidences = this.diffAnalyzer.analyzeCommitEvidences(repoCommitEvidences);

    const pillarContext = this.pillarsReader.buildPillarContext({
      roadmap: pillars?.roadmap || "",
      workflow: pillars?.workflow || "",
      decisions: pillars?.decisions || "",
    });

    const repoEvidences = [...repoCommitEvidences, ...diffEvidences];

    return {
      ok: true,
      projectKey: this.projectKey,
      repository: this.repository,
      ref: this.ref,
      repoCommitEvidences,
      diffEvidences,
      repoEvidences,
      pillarContext,
      memoryEvidences: ensureArray(memoryEvidences),
      summary: {
        commits: ensureArray(commits).length,
        repoEvidences: repoEvidences.length,
        pillarEvidences: ensureArray(pillarContext?.evidences).length,
        memoryEvidences: ensureArray(memoryEvidences).length,
      },
      warnings: [
        ensureArray(commits).length === 0 ? "No raw commits supplied." : null,
        !safeText(pillars?.workflow) ? "WORKFLOW pillar not supplied." : null,
        !safeText(pillars?.roadmap) ? "ROADMAP pillar not supplied." : null,
        !safeText(pillars?.decisions) ? "DECISIONS pillar not supplied." : null,
      ].filter(Boolean),
    };
  }
}

export default {
  ProjectEvidenceProvider,
};
