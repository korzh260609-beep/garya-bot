// src/projectExperience/ProjectExperienceSyncService.js
// ============================================================================
// STAGE C.1 — Project Experience Sync Service (SKELETON / DRY-RUN)
// Purpose:
// - orchestrate collection of project evidence (repo, workflow, memory)
// - build a snapshot WITHOUT writing into Project Memory (dry-run only)
// - prepare future integration with GitHub API and analyzers
// IMPORTANT:
// - NO DB writes
// - NO GitHub calls (stubbed)
// - DRY-RUN ONLY: returns what WOULD be collected
// ============================================================================

import {
  createProjectEvidence,
  createProjectExperienceSnapshot,
  PROJECT_EXPERIENCE_EVIDENCE_TYPES,
  PROJECT_EXPERIENCE_CONFIDENCE,
  PROJECT_EXPERIENCE_STATUSES,
} from "./projectExperienceTypes.js";

function nowIso() {
  return new Date().toISOString();
}

export class ProjectExperienceSyncService {
  constructor({ projectKey = "garya-bot", repository = "korzh260609-beep/garya-bot", ref = "main" } = {}) {
    this.projectKey = projectKey;
    this.repository = repository;
    this.ref = ref;
  }

  // ---------------------------------------------------------------------------
  // STUBS (to be replaced in Stage C.2+)
  // ---------------------------------------------------------------------------
  async collectCommitsStub({ limit = 5 } = {}) {
    return [
      createProjectEvidence({
        type: PROJECT_EXPERIENCE_EVIDENCE_TYPES.COMMIT,
        source: "github",
        ref: "stub:commit",
        title: "[stub] last commits",
        summary: `Would fetch last ${limit} commits from ${this.repository}@${this.ref}`,
        details: { limit, repository: this.repository, ref: this.ref },
        confidence: PROJECT_EXPERIENCE_CONFIDENCE.UNKNOWN,
      }),
    ];
  }

  async collectWorkflowStub() {
    return [
      createProjectEvidence({
        type: PROJECT_EXPERIENCE_EVIDENCE_TYPES.WORKFLOW_ENTRY,
        source: "repo",
        ref: "pillars/WORKFLOW.md",
        title: "[stub] workflow",
        summary: "Would parse WORKFLOW.md for stages and statuses",
        details: {},
        confidence: PROJECT_EXPERIENCE_CONFIDENCE.UNKNOWN,
      }),
    ];
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API (DRY-RUN)
  // ---------------------------------------------------------------------------
  async buildDryRunSnapshot({ stageKey = null } = {}) {
    const evidences = [];

    const commits = await this.collectCommitsStub({ limit: 5 });
    evidences.push(...commits);

    const workflow = await this.collectWorkflowStub();
    evidences.push(...workflow);

    const summary = [
      "DRY-RUN snapshot (no writes)",
      `repository: ${this.repository}@${this.ref}`,
      `evidences: ${evidences.length}`,
      `time: ${nowIso()}`,
    ].join(" | ");

    return createProjectExperienceSnapshot({
      projectKey: this.projectKey,
      repository: this.repository,
      ref: this.ref,
      stageKey,
      evidences,
      status: PROJECT_EXPERIENCE_STATUSES.UNKNOWN,
      summary,
      risks: [
        "No real GitHub data collected yet (stub mode)",
        "No verification performed",
      ],
      nextSteps: [
        "Stage C.2: implement GitHub commit collector",
        "Stage C.3: implement diff analyzer",
      ],
      meta: {
        stage: "C.1",
        dryRun: true,
      },
    });
  }
}

export default {
  ProjectExperienceSyncService,
};
