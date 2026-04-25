// src/projectExperience/ProjectExperienceReconciler.js
// ============================================================================
// STAGE C.1 — Project Experience Reconciler (SKELETON)
// Purpose:
// - reconcile repo evidence, pillars context and project memory understanding
// - detect gaps / contradictions before writing anything into Project Memory
// - keep SG aligned with pillars so it does not lose project logic
// IMPORTANT:
// - NO DB writes
// - NO GitHub calls
// - NO pillar edits
// - NO final stage completion claims without external verifier evidence
// ============================================================================

import {
  createProjectExperienceSnapshot,
  PROJECT_EXPERIENCE_STATUSES,
  PROJECT_EXPERIENCE_CONFIDENCE,
} from "./projectExperienceTypes.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeStageKey(value) {
  return safeText(value).toUpperCase();
}

function countEvidenceBySource(evidences = []) {
  const counts = {};

  for (const evidence of ensureArray(evidences)) {
    const source = safeText(evidence?.source) || "unknown";
    counts[source] = (counts[source] || 0) + 1;
  }

  return counts;
}

function findPillarStageMatches({ stageKey, pillarContext } = {}) {
  const normalizedStageKey = normalizeStageKey(stageKey);
  const pillars = ensureArray(pillarContext?.pillars);
  const matches = [];

  if (!normalizedStageKey) return matches;

  for (const pillar of pillars) {
    for (const mention of ensureArray(pillar?.stageMentions)) {
      if (normalizeStageKey(mention?.stageKey) !== normalizedStageKey) continue;

      matches.push({
        pillarKey: safeText(pillar?.key),
        path: safeText(pillar?.path),
        line: mention?.line ?? null,
        text: safeText(mention?.text),
      });
    }
  }

  return matches;
}

export class ProjectExperienceReconciler {
  reconcile({
    projectKey = "garya-bot",
    repository = "korzh260609-beep/garya-bot",
    ref = "main",
    stageKey = null,
    repoEvidences = [],
    pillarContext = null,
    memoryEvidences = [],
    manualClaims = [],
  } = {}) {
    const normalizedStageKey = normalizeStageKey(stageKey) || null;

    const allEvidences = [
      ...ensureArray(repoEvidences),
      ...ensureArray(pillarContext?.evidences),
      ...ensureArray(memoryEvidences),
      ...ensureArray(manualClaims),
    ];

    const pillarStageMatches = findPillarStageMatches({
      stageKey: normalizedStageKey,
      pillarContext,
    });

    const sourceCounts = countEvidenceBySource(allEvidences);

    const gaps = [];
    const contradictions = [];
    const risks = [];
    const nextSteps = [];

    if (ensureArray(repoEvidences).length === 0) {
      gaps.push("missing_repo_evidence");
      risks.push("No repository evidence was supplied; cannot verify implementation state.");
      nextSteps.push("Collect commits, changed files and relevant diffs from repository.");
    }

    if (!pillarContext || ensureArray(pillarContext?.pillars).length === 0) {
      gaps.push("missing_pillars_context");
      risks.push("No pillars context was supplied; project logic may be lost.");
      nextSteps.push("Read ROADMAP.md, WORKFLOW.md and DECISIONS.md in read-only mode.");
    }

    if (normalizedStageKey && pillarStageMatches.length === 0) {
      gaps.push("stage_not_found_in_pillars");
      risks.push(`Stage ${normalizedStageKey} is not linked to pillars context.`);
      nextSteps.push(`Find or define Stage ${normalizedStageKey} in WORKFLOW/ROADMAP before final verification.`);
    }

    if (ensureArray(manualClaims).length > 0 && ensureArray(repoEvidences).length === 0) {
      contradictions.push("manual_claim_without_repo_evidence");
      risks.push("Manual claim exists, but there is no repo evidence to confirm it.");
    }

    const status =
      gaps.length === 0 && contradictions.length === 0
        ? PROJECT_EXPERIENCE_STATUSES.PARTIAL
        : PROJECT_EXPERIENCE_STATUSES.UNKNOWN;

    const confidence =
      ensureArray(repoEvidences).length > 0 && pillarStageMatches.length > 0
        ? PROJECT_EXPERIENCE_CONFIDENCE.MEDIUM
        : PROJECT_EXPERIENCE_CONFIDENCE.LOW;

    const summary = [
      "Project Experience reconciliation skeleton",
      `stage=${normalizedStageKey || "none"}`,
      `status=${status}`,
      `confidence=${confidence}`,
      `evidence=${allEvidences.length}`,
      `gaps=${gaps.length}`,
      `contradictions=${contradictions.length}`,
    ].join(" | ");

    return createProjectExperienceSnapshot({
      projectKey,
      repository,
      ref,
      stageKey: normalizedStageKey,
      evidences: allEvidences,
      status,
      summary,
      risks,
      nextSteps,
      meta: {
        stage: "C.1",
        reconciler: "ProjectExperienceReconciler",
        dryRun: true,
        confidence,
        sourceCounts,
        gaps,
        contradictions,
        pillarStageMatches,
      },
    });
  }
}

export default {
  ProjectExperienceReconciler,
};
