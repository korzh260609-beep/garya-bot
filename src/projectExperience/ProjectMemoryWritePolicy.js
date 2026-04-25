// src/projectExperience/ProjectMemoryWritePolicy.js
// ============================================================================
// STAGE C.9 — Project Memory Write Policy (SKELETON / DRY-RUN)
// Purpose:
// - decide which prepared project memory records may be written
// - prevent Project Memory from becoming garbage
// - keep user/monarch claims separate from verified project facts
// - choose target layer: raw_archive / topic_digest / confirmed / skip
// IMPORTANT:
// - NO DB writes
// - NO Project Memory writes
// - NO GitHub calls
// - policy decision only
// ============================================================================

import {
  EXPERIENCE_MEMORY_RECORD_TYPES,
  EXPERIENCE_MEMORY_TRUST_LEVELS,
} from "./ProjectExperienceMemorySchema.js";

export const PROJECT_MEMORY_WRITE_DECISION = Object.freeze({
  WRITE: "write",
  SKIP: "skip",
  NEEDS_VERIFICATION: "needs_verification",
});

export const PROJECT_MEMORY_TARGET_LAYER = Object.freeze({
  RAW_ARCHIVE: "raw_archive",
  TOPIC_DIGEST: "topic_digest",
  CONFIRMED: "confirmed",
  NONE: "none",
});

function safeText(value) {
  return String(value ?? "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function getVerification(record = {}) {
  return record?.meta?.verification && typeof record.meta.verification === "object"
    ? record.meta.verification
    : null;
}

function hasUsefulSummary(record = {}) {
  return safeText(record?.summary).length >= 8;
}

function isVerified(record = {}) {
  return safeText(record?.trustLevel) === EXPERIENCE_MEMORY_TRUST_LEVELS.VERIFIED || record?.meta?.verifiedFact === true;
}

function isClaim(record = {}) {
  return (
    safeText(record?.recordType) === EXPERIENCE_MEMORY_RECORD_TYPES.CLAIM_RECORD ||
    safeText(record?.trustLevel) === EXPERIENCE_MEMORY_TRUST_LEVELS.CLAIMED ||
    record?.meta?.isClaim === true
  );
}

function isImportantRecordType(record = {}) {
  return [
    EXPERIENCE_MEMORY_RECORD_TYPES.TIMELINE_EVENT,
    EXPERIENCE_MEMORY_RECORD_TYPES.STAGE_STATE,
    EXPERIENCE_MEMORY_RECORD_TYPES.MODULE_STATE,
    EXPERIENCE_MEMORY_RECORD_TYPES.DECISION_RECORD,
    EXPERIENCE_MEMORY_RECORD_TYPES.EVIDENCE_RECORD,
    EXPERIENCE_MEMORY_RECORD_TYPES.RISK_RECORD,
    EXPERIENCE_MEMORY_RECORD_TYPES.REVISION_RECORD,
    EXPERIENCE_MEMORY_RECORD_TYPES.LESSON_RECORD,
    EXPERIENCE_MEMORY_RECORD_TYPES.CLAIM_RECORD,
  ].includes(safeText(record?.recordType));
}

export class ProjectMemoryWritePolicy {
  evaluateRecord(record = {}) {
    const recordType = safeText(record?.recordType);
    const trustLevel = safeText(record?.trustLevel) || EXPERIENCE_MEMORY_TRUST_LEVELS.UNKNOWN;
    const verification = getVerification(record);
    const verificationStatus = safeText(verification?.status);
    const captureKind = safeText(record?.meta?.captureKind);

    const reasons = [];

    if (!recordType || !isImportantRecordType(record)) {
      return {
        decision: PROJECT_MEMORY_WRITE_DECISION.SKIP,
        targetLayer: PROJECT_MEMORY_TARGET_LAYER.NONE,
        reasons: ["unsupported_or_missing_record_type"],
      };
    }

    if (!hasUsefulSummary(record)) {
      return {
        decision: PROJECT_MEMORY_WRITE_DECISION.SKIP,
        targetLayer: PROJECT_MEMORY_TARGET_LAYER.NONE,
        reasons: ["summary_too_short_or_empty"],
      };
    }

    if (isVerified(record)) {
      return {
        decision: PROJECT_MEMORY_WRITE_DECISION.WRITE,
        targetLayer: PROJECT_MEMORY_TARGET_LAYER.CONFIRMED,
        reasons: ["verified_record"],
      };
    }

    if (recordType === EXPERIENCE_MEMORY_RECORD_TYPES.EVIDENCE_RECORD) {
      return {
        decision: PROJECT_MEMORY_WRITE_DECISION.WRITE,
        targetLayer: PROJECT_MEMORY_TARGET_LAYER.RAW_ARCHIVE,
        reasons: ["raw_evidence_record"],
      };
    }

    if (recordType === EXPERIENCE_MEMORY_RECORD_TYPES.TIMELINE_EVENT && !isClaim(record)) {
      return {
        decision: PROJECT_MEMORY_WRITE_DECISION.WRITE,
        targetLayer: PROJECT_MEMORY_TARGET_LAYER.RAW_ARCHIVE,
        reasons: ["non_claim_timeline_event"],
      };
    }

    if (isClaim(record)) {
      reasons.push("user_or_monarch_claim_not_fact");

      if (verificationStatus === "partial") {
        return {
          decision: PROJECT_MEMORY_WRITE_DECISION.WRITE,
          targetLayer: PROJECT_MEMORY_TARGET_LAYER.TOPIC_DIGEST,
          reasons: [...reasons, "partial_verification_claim_kept_as_digest"],
        };
      }

      if (verificationStatus === "verified") {
        return {
          decision: PROJECT_MEMORY_WRITE_DECISION.WRITE,
          targetLayer: PROJECT_MEMORY_TARGET_LAYER.TOPIC_DIGEST,
          reasons: [...reasons, "claim_verified_but_not_promoted_to_confirmed_by_policy"],
        };
      }

      return {
        decision: PROJECT_MEMORY_WRITE_DECISION.NEEDS_VERIFICATION,
        targetLayer: PROJECT_MEMORY_TARGET_LAYER.NONE,
        reasons: [...reasons, verificationStatus ? `verification_${verificationStatus}` : "missing_verification"],
      };
    }

    if (
      recordType === EXPERIENCE_MEMORY_RECORD_TYPES.DECISION_RECORD ||
      recordType === EXPERIENCE_MEMORY_RECORD_TYPES.RISK_RECORD ||
      recordType === EXPERIENCE_MEMORY_RECORD_TYPES.REVISION_RECORD ||
      captureKind
    ) {
      return {
        decision: PROJECT_MEMORY_WRITE_DECISION.WRITE,
        targetLayer: PROJECT_MEMORY_TARGET_LAYER.TOPIC_DIGEST,
        reasons: ["important_project_context_candidate"],
      };
    }

    return {
      decision: PROJECT_MEMORY_WRITE_DECISION.NEEDS_VERIFICATION,
      targetLayer: PROJECT_MEMORY_TARGET_LAYER.NONE,
      reasons: ["default_requires_verification"],
      trustLevel,
      verificationStatus,
    };
  }

  evaluateRecords(records = []) {
    return ensureArray(records).map((record) => ({
      record,
      policy: this.evaluateRecord(record),
    }));
  }
}

export default {
  PROJECT_MEMORY_WRITE_DECISION,
  PROJECT_MEMORY_TARGET_LAYER,
  ProjectMemoryWritePolicy,
};
