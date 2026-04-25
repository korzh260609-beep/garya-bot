// src/projectExperience/ProjectEvidenceTriggerPolicy.js
// ============================================================================
// STAGE C.9D — Project Evidence Trigger Policy (SKELETON / LIGHT MODE)
// Purpose:
// - decide when Project Memory evidence should be fetched/built
// - prevent GitHub/pillars work on every message
// - keep evidence loading event/session-driven and depth-controlled
// IMPORTANT:
// - NO DB writes
// - NO Project Memory writes
// - NO GitHub calls
// - policy decision only
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

const DEFAULT_TRIGGER_ALLOWLIST = Object.freeze([
  "project_work",
  "stage_check",
  "architecture_change",
  "memory_write",
  "risk_or_contradiction",
]);

const DEFAULT_DEPTH_ALLOWLIST = Object.freeze([
  "targeted",
  "deep",
]);

export class ProjectEvidenceTriggerPolicy {
  constructor({
    triggerAllowlist = DEFAULT_TRIGGER_ALLOWLIST,
    depthAllowlist = DEFAULT_DEPTH_ALLOWLIST,
  } = {}) {
    this.triggerAllowlist = ensureArray(triggerAllowlist).map(safeText).filter(Boolean);
    this.depthAllowlist = ensureArray(depthAllowlist).map(safeText).filter(Boolean);
  }

  shouldBuildEvidence({
    projectContextDecision = null,
    hasExistingEvidencePack = false,
    force = false,
  } = {}) {
    const depth = safeText(projectContextDecision?.depth) || "none";
    const trigger = safeText(projectContextDecision?.trigger) || "none";
    const reasons = [];

    if (hasExistingEvidencePack) {
      return {
        shouldBuild: false,
        depth,
        trigger,
        reasons: ["existing_evidence_pack_present"],
      };
    }

    if (force) {
      return {
        shouldBuild: true,
        depth,
        trigger,
        reasons: ["forced_by_context_or_deps"],
      };
    }

    if (depth === "none") {
      return {
        shouldBuild: false,
        depth,
        trigger,
        reasons: ["project_context_depth_none"],
      };
    }

    if (!this.depthAllowlist.includes(depth)) {
      return {
        shouldBuild: false,
        depth,
        trigger,
        reasons: [`depth_not_allowed:${depth}`],
      };
    }

    if (!this.triggerAllowlist.includes(trigger)) {
      return {
        shouldBuild: false,
        depth,
        trigger,
        reasons: [`trigger_not_allowed:${trigger}`],
      };
    }

    reasons.push(`depth_allowed:${depth}`);
    reasons.push(`trigger_allowed:${trigger}`);

    return {
      shouldBuild: true,
      depth,
      trigger,
      reasons,
    };
  }
}

export default {
  ProjectEvidenceTriggerPolicy,
};
