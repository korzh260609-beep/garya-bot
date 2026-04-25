// src/projectExperience/ProjectContextEngine.js
// ============================================================================
// STAGE C.5 — Project Context Engine (SKELETON / DECISION LAYER)
// Purpose:
// - decide how deep SG should inspect project state during active project work
// - use Project Experience Orchestrator to build a current working context
// - keep SG aligned with repo facts, pillars, memory and current user intent
// IMPORTANT:
// - NO DB writes
// - NO Project Memory writes
// - NO GitHub calls here; caller supplies commits/pillars/memory evidence
// - NO final stage completion claims
// ============================================================================

import { ProjectExperienceOrchestrator } from "./ProjectExperienceOrchestrator.js";

export const PROJECT_CONTEXT_DEPTH = Object.freeze({
  NONE: "none",
  SHALLOW: "shallow",
  TARGETED: "targeted",
  DEEP: "deep",
});

export const PROJECT_CONTEXT_TRIGGERS = Object.freeze({
  PROJECT_WORK: "project_work",
  STAGE_CHECK: "stage_check",
  ARCHITECTURE_CHANGE: "architecture_change",
  MEMORY_WRITE: "memory_write",
  RISK_OR_CONTRADICTION: "risk_or_contradiction",
  UNKNOWN: "unknown",
});

function safeText(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return safeText(value).toLowerCase().replace(/ё/g, "е");
}

function hasAny(text = "", patterns = []) {
  const s = lower(text);
  return patterns.some((p) => p.test(s));
}

function extractStageKey(text = "") {
  const match = safeText(text).match(/(?:stage|этап)\s+([0-9]+[a-zа-я]?(?:\.[0-9]+)?)/i);
  return match ? safeText(match[1]).toUpperCase() : null;
}

export class ProjectContextEngine {
  constructor({
    projectKey = "garya-bot",
    repository = "korzh260609-beep/garya-bot",
    ref = "main",
  } = {}) {
    this.projectKey = projectKey;
    this.repository = repository;
    this.ref = ref;
    this.orchestrator = new ProjectExperienceOrchestrator({ projectKey, repository, ref });
  }

  classifyProjectContextNeed({ text = "", hasActiveProjectSession = false } = {}) {
    const sourceText = safeText(text);
    const stageKey = extractStageKey(sourceText);

    const wantsStageCheck = hasAny(sourceText, [
      /\bstage\b/i,
      /\bэтап\b/i,
      /заверш/i,
      /готов/i,
      /статус/i,
      /проверь/i,
    ]);

    const wantsArchitectureWork = hasAny(sourceText, [
      /архитектур/i,
      /скелет/i,
      /модул/i,
      /структур/i,
      /reconciler/i,
      /orchestrator/i,
      /engine/i,
    ]);

    const wantsMemoryWrite = hasAny(sourceText, [
      /запиши/i,
      /сохрани/i,
      /памят/i,
      /memory/i,
    ]);

    const hasRiskSignal = hasAny(sourceText, [
      /риск/i,
      /ошиб/i,
      /слом/i,
      /пута/i,
      /противореч/i,
      /нельзя/i,
      /важн/i,
    ]);

    if (!sourceText && !hasActiveProjectSession) {
      return {
        depth: PROJECT_CONTEXT_DEPTH.NONE,
        trigger: PROJECT_CONTEXT_TRIGGERS.UNKNOWN,
        stageKey: null,
        reasons: ["no_project_signal"],
      };
    }

    if (hasRiskSignal || (wantsArchitectureWork && wantsMemoryWrite)) {
      return {
        depth: PROJECT_CONTEXT_DEPTH.DEEP,
        trigger: PROJECT_CONTEXT_TRIGGERS.RISK_OR_CONTRADICTION,
        stageKey,
        reasons: ["risk_or_contradiction_signal"],
      };
    }

    if (wantsArchitectureWork) {
      return {
        depth: PROJECT_CONTEXT_DEPTH.DEEP,
        trigger: PROJECT_CONTEXT_TRIGGERS.ARCHITECTURE_CHANGE,
        stageKey,
        reasons: ["architecture_work_signal"],
      };
    }

    if (wantsStageCheck || stageKey) {
      return {
        depth: PROJECT_CONTEXT_DEPTH.TARGETED,
        trigger: PROJECT_CONTEXT_TRIGGERS.STAGE_CHECK,
        stageKey,
        reasons: ["stage_signal"],
      };
    }

    if (wantsMemoryWrite) {
      return {
        depth: PROJECT_CONTEXT_DEPTH.TARGETED,
        trigger: PROJECT_CONTEXT_TRIGGERS.MEMORY_WRITE,
        stageKey,
        reasons: ["memory_write_signal"],
      };
    }

    if (hasActiveProjectSession) {
      return {
        depth: PROJECT_CONTEXT_DEPTH.SHALLOW,
        trigger: PROJECT_CONTEXT_TRIGGERS.PROJECT_WORK,
        stageKey,
        reasons: ["active_project_session"],
      };
    }

    return {
      depth: PROJECT_CONTEXT_DEPTH.NONE,
      trigger: PROJECT_CONTEXT_TRIGGERS.UNKNOWN,
      stageKey,
      reasons: ["no_project_context_required"],
    };
  }

  buildWorkingContext({
    text = "",
    hasActiveProjectSession = false,
    commits = [],
    pillars = {},
    memoryEvidences = [],
    manualClaims = [],
  } = {}) {
    const decision = this.classifyProjectContextNeed({ text, hasActiveProjectSession });

    if (decision.depth === PROJECT_CONTEXT_DEPTH.NONE) {
      return {
        ok: true,
        needed: false,
        decision,
        experience: null,
        warnings: [],
      };
    }

    const experience = this.orchestrator.buildDryRunExperience({
      stageKey: decision.stageKey,
      commits,
      pillars,
      memoryEvidences,
      manualClaims,
    });

    return {
      ok: true,
      needed: true,
      decision,
      experience,
      warnings: [
        "ProjectContextEngine is dry-run only and does not write memory.",
        "Caller must decide whether to fetch more repo history depending on depth.",
      ],
    };
  }
}

export default {
  PROJECT_CONTEXT_DEPTH,
  PROJECT_CONTEXT_TRIGGERS,
  ProjectContextEngine,
};
