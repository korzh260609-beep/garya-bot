// src/projectExperience/ProjectExperienceOrchestrator.js
// ============================================================================
// STAGE C.4 — Project Experience Orchestrator (DRY-RUN)
// Purpose:
// - assemble the Project Experience pipeline in one place
// - connect commits, diff analysis, pillars, reconciliation, timeline and memory schema
// - prepare structured memory records WITHOUT writing them
// IMPORTANT:
// - NO DB writes
// - NO Project Memory writes
// - NO GitHub calls here; caller supplies commit payloads and pillar contents
// - NO final stage completion claims
// ============================================================================

import { GitCommitCollector } from "./GitCommitCollector.js";
import { DiffAnalyzer } from "./DiffAnalyzer.js";
import { PillarsContextReader } from "./PillarsContextReader.js";
import { ProjectExperienceReconciler } from "./ProjectExperienceReconciler.js";
import { ProjectTimelineBuilder } from "./ProjectTimelineBuilder.js";
import {
  createTimelineEventRecord,
  createStageStateRecord,
  EXPERIENCE_MEMORY_SOURCE_TYPES,
  EXPERIENCE_MEMORY_TRUST_LEVELS,
} from "./ProjectExperienceMemorySchema.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function makeCommitTimelineRecords({ timeline = null, stageKey = null } = {}) {
  const items = ensureArray(timeline?.items);

  return items.map((item) =>
    createTimelineEventRecord({
      projectKey: "garya-bot",
      stageKey,
      title: item.title || item.ref || "Project timeline event",
      summary: item.summary,
      chronologyTime: item.time,
      sourceType:
        item.source === "github"
          ? EXPERIENCE_MEMORY_SOURCE_TYPES.GITHUB_COMMIT
          : item.source === "diff_analyzer"
            ? EXPERIENCE_MEMORY_SOURCE_TYPES.GITHUB_DIFF
            : EXPERIENCE_MEMORY_SOURCE_TYPES.SYSTEM_ANALYSIS,
      sourceRef: item.ref,
      trustLevel:
        item.source === "github"
          ? EXPERIENCE_MEMORY_TRUST_LEVELS.VERIFIED
          : EXPERIENCE_MEMORY_TRUST_LEVELS.INFERRED,
      relatedFiles: ensureArray(item?.details?.files).map((file) => file?.filename).filter(Boolean),
      risks: ensureArray(item?.details?.risks),
      meta: {
        originalSource: item.source,
        originalType: item.type,
        confidence: item.confidence,
      },
    })
  );
}

function makeStageStateDraftRecord({ snapshot = null, stageKey = null } = {}) {
  return createStageStateRecord({
    projectKey: "garya-bot",
    stageKey,
    title: stageKey ? `Stage ${stageKey} state draft` : "Project state draft",
    summary: snapshot?.summary || "Project state draft prepared by ProjectExperienceOrchestrator",
    sourceType: EXPERIENCE_MEMORY_SOURCE_TYPES.SYSTEM_ANALYSIS,
    sourceRef: "project_experience_orchestrator:dry_run",
    trustLevel: EXPERIENCE_MEMORY_TRUST_LEVELS.INFERRED,
    evidenceRefs: ensureArray(snapshot?.evidences).map((e) => e?.ref).filter(Boolean),
    risks: ensureArray(snapshot?.risks),
    nextSteps: ensureArray(snapshot?.nextSteps),
    meta: {
      dryRun: true,
      status: snapshot?.status || "unknown",
      reconcilerMeta: snapshot?.meta || {},
    },
  });
}

export class ProjectExperienceOrchestrator {
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
    this.reconciler = new ProjectExperienceReconciler();
    this.timelineBuilder = new ProjectTimelineBuilder();
  }

  buildDryRunExperience({
    stageKey = null,
    commits = [],
    pillars = {},
    memoryEvidences = [],
    manualClaims = [],
  } = {}) {
    const normalizedStageKey = safeText(stageKey).toUpperCase() || null;

    const repoEvidences = this.commitCollector.commitsToEvidences(commits);
    const diffEvidences = this.diffAnalyzer.analyzeCommitEvidences(repoEvidences);

    const pillarContext = this.pillarsReader.buildPillarContext({
      roadmap: pillars?.roadmap || "",
      workflow: pillars?.workflow || "",
      decisions: pillars?.decisions || "",
    });

    const timeline = this.timelineBuilder.buildTimeline({
      repoEvidences,
      diffEvidences,
      pillarEvidences: pillarContext.evidences,
      memoryEvidences,
      manualClaims,
    });

    const snapshot = this.reconciler.reconcile({
      projectKey: this.projectKey,
      repository: this.repository,
      ref: this.ref,
      stageKey: normalizedStageKey,
      repoEvidences: [...repoEvidences, ...diffEvidences],
      pillarContext,
      memoryEvidences,
      manualClaims,
    });

    const preparedMemoryRecords = [
      ...makeCommitTimelineRecords({ timeline, stageKey: normalizedStageKey }),
      makeStageStateDraftRecord({ snapshot, stageKey: normalizedStageKey }),
    ];

    return {
      ok: true,
      dryRun: true,
      projectKey: this.projectKey,
      repository: this.repository,
      ref: this.ref,
      stageKey: normalizedStageKey,
      repoEvidences,
      diffEvidences,
      pillarContext,
      timeline,
      snapshot,
      preparedMemoryRecords,
      warnings: [
        "Dry-run only: no Project Memory writes were performed.",
        "Stage status is not final; verifier/reconciliation evidence is required before confirmed memory writes.",
      ],
    };
  }
}

export default {
  ProjectExperienceOrchestrator,
};
