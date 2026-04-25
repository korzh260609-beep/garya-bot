// src/projectExperience/ProjectClaimVerifier.js
// ============================================================================
// STAGE C.8 — Project Claim Verifier (SKELETON / EVIDENCE-BASED)
// Purpose:
// - verify user/monarch claims against repo evidence, pillars and project memory
// - prevent user statements from becoming technical facts without evidence
// - produce verification result for future Project Memory confirmed/revision writes
// IMPORTANT:
// - NO DB writes
// - NO Project Memory writes
// - NO GitHub calls here; caller supplies evidences/pillars/memory
// - NO final writes; returns verification result only
// ============================================================================

export const CLAIM_VERIFICATION_STATUS = Object.freeze({
  VERIFIED: "verified",
  PARTIAL: "partial",
  REJECTED: "rejected",
  INSUFFICIENT_EVIDENCE: "insufficient_evidence",
  UNKNOWN: "unknown",
});

function safeText(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return safeText(value).toLowerCase().replace(/ё/g, "е");
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function extractStageKey(text = "") {
  const match = safeText(text).match(/(?:stage|этап)\s+([0-9]+[a-zа-я]?(?:\.[0-9]+)?)/i);
  return match ? safeText(match[1]).toUpperCase() : null;
}

function detectClaimKind(text = "") {
  const s = lower(text);

  if (/заверш|готов|completed|done/.test(s) && /этап|stage/.test(s)) {
    return "stage_completion";
  }

  if (/риск|опасн|слом|ошиб|risk|danger|break/.test(s)) {
    return "risk_claim";
  }

  if (/решил|решили|принято|выбрали|отказались|decision|decided/.test(s)) {
    return "decision_claim";
  }

  return "generic_project_claim";
}

function evidenceMentionsStage(evidence = {}, stageKey = "") {
  const stage = lower(stageKey);
  if (!stage) return false;

  const blob = lower([
    evidence?.title,
    evidence?.summary,
    evidence?.ref,
    evidence?.details?.message,
    ensureArray(evidence?.details?.files).map((file) => file?.filename).join(" "),
  ].join(" "));

  return blob.includes(stage);
}

function countRepoEvidence(repoEvidences = [], stageKey = null) {
  const evidences = ensureArray(repoEvidences);
  if (!stageKey) return evidences.length;
  return evidences.filter((e) => evidenceMentionsStage(e, stageKey)).length;
}

function countPillarMatches(pillarContext = null, stageKey = null) {
  if (!stageKey) return 0;

  const pillars = ensureArray(pillarContext?.pillars);
  let count = 0;

  for (const pillar of pillars) {
    for (const mention of ensureArray(pillar?.stageMentions)) {
      if (safeText(mention?.stageKey).toUpperCase() === safeText(stageKey).toUpperCase()) {
        count += 1;
      }
    }
  }

  return count;
}

export class ProjectClaimVerifier {
  verifyClaim({
    claimRecord = null,
    claimText = "",
    repoEvidences = [],
    pillarContext = null,
    memoryEvidences = [],
  } = {}) {
    const text = safeText(claimText || claimRecord?.summary);
    const stageKey = safeText(claimRecord?.stageKey) || extractStageKey(text);
    const claimKind = detectClaimKind(text);

    if (!text) {
      return {
        ok: false,
        status: CLAIM_VERIFICATION_STATUS.UNKNOWN,
        claimKind,
        stageKey: stageKey || null,
        confidence: "low",
        reasons: ["empty_claim"],
        evidenceRefs: [],
        gaps: ["claim_text_missing"],
      };
    }

    const repoCount = countRepoEvidence(repoEvidences, stageKey);
    const pillarCount = countPillarMatches(pillarContext, stageKey);
    const memoryCount = ensureArray(memoryEvidences).length;

    const evidenceRefs = [
      ...ensureArray(repoEvidences).map((e) => e?.ref).filter(Boolean),
      ...ensureArray(pillarContext?.evidences).map((e) => e?.ref).filter(Boolean),
      ...ensureArray(memoryEvidences).map((e) => e?.ref).filter(Boolean),
    ];

    const gaps = [];
    const reasons = [];

    if (repoCount === 0) gaps.push("missing_repo_evidence");
    if (stageKey && pillarCount === 0) gaps.push("stage_missing_in_pillars");

    if (claimKind === "stage_completion") {
      if (repoCount > 0 && pillarCount > 0) {
        reasons.push("stage_has_repo_and_pillar_evidence_but_completion_not_finalized_by_tests");
        return {
          ok: true,
          status: CLAIM_VERIFICATION_STATUS.PARTIAL,
          claimKind,
          stageKey: stageKey || null,
          confidence: "medium",
          reasons,
          evidenceRefs,
          gaps,
          recommendation: "Run deeper verifier: check required files, workflow status, tests and project memory before marking stage verified.",
        };
      }

      return {
        ok: true,
        status: CLAIM_VERIFICATION_STATUS.INSUFFICIENT_EVIDENCE,
        claimKind,
        stageKey: stageKey || null,
        confidence: "low",
        reasons: ["stage_completion_claim_requires_repo_pillars_tests"],
        evidenceRefs,
        gaps,
        recommendation: "Do not mark stage completed. Collect repo commits, changed files, pillars context and test evidence first.",
      };
    }

    if (repoCount > 0 || pillarCount > 0 || memoryCount > 0) {
      return {
        ok: true,
        status: CLAIM_VERIFICATION_STATUS.PARTIAL,
        claimKind,
        stageKey: stageKey || null,
        confidence: "medium",
        reasons: ["some_supporting_context_found"],
        evidenceRefs,
        gaps,
        recommendation: "Keep as claimed/inferred until a specific verifier confirms it.",
      };
    }

    return {
      ok: true,
      status: CLAIM_VERIFICATION_STATUS.INSUFFICIENT_EVIDENCE,
      claimKind,
      stageKey: stageKey || null,
      confidence: "low",
      reasons: ["no_supporting_evidence_found"],
      evidenceRefs,
      gaps,
      recommendation: "Keep as claim only; do not promote to fact.",
    };
  }
}

export default {
  CLAIM_VERIFICATION_STATUS,
  ProjectClaimVerifier,
};
