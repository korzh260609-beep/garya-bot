// src/projectExperience/ProjectMemoryAutoCapture.js
// ============================================================================
// STAGE C.7 — Project Memory Auto Capture (SKELETON / DRY-RUN)
// UPDATED: user/monarch statements are treated as CLAIMS, not facts
// UPDATED: claim records are immediately passed through ProjectClaimVerifier
// ============================================================================

import {
  createTimelineEventRecord,
  createDecisionRecord,
  createRevisionRecord,
  createStageStateRecord,
  createClaimRecord,
  EXPERIENCE_MEMORY_SOURCE_TYPES,
  EXPERIENCE_MEMORY_TRUST_LEVELS,
} from "./ProjectExperienceMemorySchema.js";
import { ProjectClaimVerifier } from "./ProjectClaimVerifier.js";

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

function withVerification(record, verification) {
  return {
    ...record,
    meta: {
      ...(record?.meta && typeof record.meta === "object" ? record.meta : {}),
      verification,
      verifiedFact: false,
    },
  };
}

export class ProjectMemoryAutoCapture {
  constructor({ claimVerifier = new ProjectClaimVerifier() } = {}) {
    this.claimVerifier = claimVerifier;
  }

  prepareFromUserMessage({
    text = "",
    projectKey = "garya-bot",
    sourceRef = null,
    isMonarchUser = false,
    projectContextDecision = null,
    repoEvidences = [],
    pillarContext = null,
    memoryEvidences = [],
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

    const claimRecord = createClaimRecord({
      projectKey,
      stageKey,
      title: "User/Monarch project statement",
      summary: sourceText,
      sourceType: isMonarchUser
        ? EXPERIENCE_MEMORY_SOURCE_TYPES.MONARCH_CLAIM
        : EXPERIENCE_MEMORY_SOURCE_TYPES.USER_CLAIM,
      sourceRef,
      reason: "User-provided statement; must be verified against repo/pillars before becoming fact.",
    });

    const verification = this.claimVerifier.verifyClaim({
      claimRecord,
      repoEvidences,
      pillarContext,
      memoryEvidences,
    });

    records.push(withVerification(claimRecord, verification));
    reasons.push("user_claim");

    if (detectDecisionSignal(sourceText)) {
      records.push(
        withVerification(
          createDecisionRecord({
            projectKey,
            stageKey,
            title: "Project decision candidate",
            summary: sourceText,
            sourceType: isMonarchUser
              ? EXPERIENCE_MEMORY_SOURCE_TYPES.MONARCH_CLAIM
              : EXPERIENCE_MEMORY_SOURCE_TYPES.USER_CLAIM,
            sourceRef,
            trustLevel: EXPERIENCE_MEMORY_TRUST_LEVELS.CLAIMED,
            reason: "Decision detected from user statement; requires verification/context linking.",
            meta: {
              autoCapture: true,
              captureKind: "decision_candidate",
              requiresVerification: true,
            },
          }),
          verification
        )
      );
      reasons.push("decision_signal");
    }

    if (detectRiskSignal(sourceText)) {
      records.push(
        withVerification(
          createTimelineEventRecord({
            projectKey,
            stageKey,
            title: "Project risk candidate",
            summary: sourceText,
            sourceType: isMonarchUser
              ? EXPERIENCE_MEMORY_SOURCE_TYPES.MONARCH_CLAIM
              : EXPERIENCE_MEMORY_SOURCE_TYPES.USER_CLAIM,
            sourceRef,
            trustLevel: EXPERIENCE_MEMORY_TRUST_LEVELS.CLAIMED,
            risks: [sourceText],
            meta: {
              autoCapture: true,
              captureKind: "risk_candidate",
              requiresVerification: true,
            },
          }),
          verification
        )
      );
      reasons.push("risk_signal");
    }

    if (detectRevisionSignal(sourceText)) {
      records.push(
        withVerification(
          createRevisionRecord({
            projectKey,
            stageKey,
            title: "Revision candidate",
            summary: sourceText,
            sourceType: isMonarchUser
              ? EXPERIENCE_MEMORY_SOURCE_TYPES.MONARCH_CLAIM
              : EXPERIENCE_MEMORY_SOURCE_TYPES.USER_CLAIM,
            sourceRef,
            trustLevel: EXPERIENCE_MEMORY_TRUST_LEVELS.CLAIMED,
            reason: "Revision detected; requires validation.",
            meta: {
              autoCapture: true,
              captureKind: "revision_candidate",
              requiresVerification: true,
            },
          }),
          verification
        )
      );
      reasons.push("revision_signal");
    }

    if (detectStageStateSignal(sourceText)) {
      records.push(
        withVerification(
          createStageStateRecord({
            projectKey,
            stageKey,
            title: stageKey ? `Stage ${stageKey} state candidate` : "Stage state candidate",
            summary: sourceText,
            sourceType: isMonarchUser
              ? EXPERIENCE_MEMORY_SOURCE_TYPES.MONARCH_CLAIM
              : EXPERIENCE_MEMORY_SOURCE_TYPES.USER_CLAIM,
            sourceRef,
            trustLevel: EXPERIENCE_MEMORY_TRUST_LEVELS.CLAIMED,
            reason: "Stage/state claimed by user; must be verified via repo/pillars.",
            meta: {
              autoCapture: true,
              captureKind: "stage_state_candidate",
              requiresVerification: true,
            },
          }),
          verification
        )
      );
      reasons.push("stage_state_signal");
    }

    return {
      shouldCapture: true,
      records,
      reasons: unique(reasons),
      dryRun: true,
      verification,
      warning: "User statements stored as CLAIMS only. No verified facts recorded.",
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
