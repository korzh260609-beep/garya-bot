// src/projectExperience/ProjectMemoryAutoCapture.js
// ============================================================================
// STAGE C.7 — Project Memory Auto Capture (SKELETON / DRY-RUN)
// Purpose:
// - automatically decide which project events should become structured memory records
// - reduce the need for users/monarch to manually say "save this to memory"
// - keep project memory structured, evidence-linked and trust-aware
// IMPORTANT:
// - NO DB writes
// - NO Project Memory writes
// - NO GitHub calls
// - prepares records only; writer must be explicit and guarded
// ============================================================================

import {
  createTimelineEventRecord,
  createDecisionRecord,
  createRevisionRecord,
  createStageStateRecord,
  EXPERIENCE_MEMORY_SOURCE_TYPES,
  EXPERIENCE_MEMORY_TRUST_LEVELS,
} from "./ProjectExperienceMemorySchema.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return safeText(value).toLowerCase().replace(/ё/g, "е");
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values = []) {
  return [...new Set(ensureArray(values).map(safeText).filter(Boolean))];
}

function extractStageKey(text = "") {
  const match = safeText(text).match(/(?:stage|этап)\s+([0-9]+[a-zа-я]?(?:\.[0-9]+)?)/i);
  return match ? safeText(match[1]).toUpperCase() : null;
}

function detectDecisionSignal(text = "") {
  const s = lower(text);
  return /решил|решили|принято|выбрали|отказались|делаем так|decision|decided/.test(s);
}

function detectRiskSignal(text = "") {
  const s = lower(text);
  return /риск|опасн|слом|ошиб|противореч|нельзя|важн|risk|danger|break/.test(s);
}

function detectRevisionSignal(text = "") {
  const s = lower(text);
  return /пересмотр|изменить понимание|оказалось|раньше думали|теперь понимаем|revision|reconcile/.test(s);
}

function detectStageStateSignal(text = "") {
  const s = lower(text);
  return /этап|stage|статус|заверш|готов|blocked|partial|verified/.test(s);
}

export class ProjectMemoryAutoCapture {
  prepareFromUserMessage({
    text = "",
    projectKey = "garya-bot",
    sourceRef = null,
    isMonarchUser = false,
    projectContextDecision = null,
  } = {}) {
    const sourceText = safeText(text);
    const stageKey = extractStageKey(sourceText) || safeText(projectContextDecision?.stageKey) || null;
    const records = [];
    const reasons = [];

    if (!sourceText) {
      return {
        shouldCapture: false,
        records: [],
        reasons: ["empty_text"],
      };
    }

    const trustLevel = isMonarchUser
      ? EXPERIENCE_MEMORY_TRUST_LEVELS.CLAIMED
      : EXPERIENCE_MEMORY_TRUST_LEVELS.UNKNOWN;

    if (detectDecisionSignal(sourceText)) {
      records.push(
        createDecisionRecord({
          projectKey,
          stageKey,
          title: "Project decision candidate",
          summary: sourceText,
          sourceType: isMonarchUser
            ? EXPERIENCE_MEMORY_SOURCE_TYPES.MONARCH_CLAIM
            : EXPERIENCE_MEMORY_SOURCE_TYPES.SYSTEM_ANALYSIS,
          sourceRef,
          trustLevel,
          reason: "Detected decision-like project statement.",
          meta: {
            autoCapture: true,
            classifier: "ProjectMemoryAutoCapture",
            captureKind: "decision_candidate",
          },
        })
      );
      reasons.push("decision_signal");
    }

    if (detectRiskSignal(sourceText)) {
      records.push(
        createTimelineEventRecord({
          projectKey,
          stageKey,
          title: "Project risk/concern candidate",
          summary: sourceText,
          sourceType: isMonarchUser
            ? EXPERIENCE_MEMORY_SOURCE_TYPES.MONARCH_CLAIM
            : EXPERIENCE_MEMORY_SOURCE_TYPES.SYSTEM_ANALYSIS,
          sourceRef,
          trustLevel,
          risks: [sourceText],
          meta: {
            autoCapture: true,
            classifier: "ProjectMemoryAutoCapture",
            captureKind: "risk_candidate",
          },
        })
      );
      reasons.push("risk_signal");
    }

    if (detectRevisionSignal(sourceText)) {
      records.push(
        createRevisionRecord({
          projectKey,
          stageKey,
          title: "Project understanding revision candidate",
          summary: sourceText,
          sourceType: isMonarchUser
            ? EXPERIENCE_MEMORY_SOURCE_TYPES.MONARCH_CLAIM
            : EXPERIENCE_MEMORY_SOURCE_TYPES.SYSTEM_ANALYSIS,
          sourceRef,
          trustLevel,
          reason: "Detected project understanding revision signal.",
          meta: {
            autoCapture: true,
            classifier: "ProjectMemoryAutoCapture",
            captureKind: "revision_candidate",
          },
        })
      );
      reasons.push("revision_signal");
    }

    if (detectStageStateSignal(sourceText)) {
      records.push(
        createStageStateRecord({
          projectKey,
          stageKey,
          title: stageKey ? `Stage ${stageKey} state candidate` : "Stage state candidate",
          summary: sourceText,
          sourceType: isMonarchUser
            ? EXPERIENCE_MEMORY_SOURCE_TYPES.MONARCH_CLAIM
            : EXPERIENCE_MEMORY_SOURCE_TYPES.SYSTEM_ANALYSIS,
          sourceRef,
          trustLevel,
          reason: "Detected stage/status-related statement; requires repo/pillars verification before confirmed fact.",
          meta: {
            autoCapture: true,
            classifier: "ProjectMemoryAutoCapture",
            captureKind: "stage_state_candidate",
            requiresVerification: true,
          },
        })
      );
      reasons.push("stage_state_signal");
    }

    return {
      shouldCapture: records.length > 0,
      records,
      reasons: unique(reasons),
      dryRun: true,
      warning: records.length > 0
        ? "Prepared memory records only; no Project Memory write performed."
        : null,
    };
  }

  prepareFromExperienceResult({ experienceResult = null, projectKey = "garya-bot" } = {}) {
    const prepared = ensureArray(experienceResult?.preparedMemoryRecords);

    return {
      shouldCapture: prepared.length > 0,
      records: prepared.map((record) => ({
        ...record,
        projectKey: safeText(record?.projectKey) || projectKey,
        meta: {
          ...(record?.meta && typeof record.meta === "object" ? record.meta : {}),
          autoCapture: true,
          source: "project_experience_result",
        },
      })),
      reasons: prepared.length > 0 ? ["experience_prepared_records"] : [],
      dryRun: true,
      warning: prepared.length > 0
        ? "Prepared experience memory records only; no Project Memory write performed."
        : null,
    };
  }
}

export default {
  ProjectMemoryAutoCapture,
};
