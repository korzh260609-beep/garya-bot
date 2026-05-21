// src/memory/project/projectMemoryAutoConfirmationPolicy.js
// SG 2.0 — Project Memory Auto-Confirmation Policy skeleton.
// Pure evaluation only: no storage, no transport, no AI, no source fetch, no runtime mutation.

export const PROJECT_MEMORY_AUTO_CONFIRMATION_POLICY_VERSION = 1;

export const PROJECT_MEMORY_AUTO_CONFIRMATION_POLICY_MODES = Object.freeze({
  PURE_POLICY_EVALUATION_ONLY: "pure_policy_evaluation_only",
});

export const PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS = Object.freeze({
  GITHUB_PR_MERGED: "github_pr_merged",
  RENDER_DEPLOY_LOGS: "render_deploy_logs",
  RAW_CHAT: "raw_chat",
  UNKNOWN: "unknown",
});

export const PROJECT_MEMORY_AUTO_CONFIRMATION_DECISIONS = Object.freeze({
  ALLOW: "auto_confirmation_allowed",
  DENY: "auto_confirmation_denied",
});

export const PROJECT_MEMORY_AUTO_CONFIRMATION_DENY_REASONS = Object.freeze({
  RAW_CHAT_SOURCE_DENIED: "raw_chat_source_denied",
  UNKNOWN_SOURCE_DENIED: "unknown_source_denied",
  AMBIGUOUS_EVENT: "ambiguous_event",
  MISSING_SOURCE_REF: "missing_source_ref",
  WRONG_REPOSITORY: "wrong_repository",
  WRONG_BRANCH: "wrong_branch",
  WEAK_EVIDENCE: "weak_evidence",
  RENDER_EVIDENCE_NOT_VERIFIED: "render_evidence_not_verified",
});

const ALLOWED_REPOSITORY_FULL_NAME = "korzh260609-beep/garya-bot";
const ALLOWED_BASE_BRANCH = "dev/v2-start";
const GITHUB_PR_MERGED_EVENT_TYPE = "pr_merged";
const RENDER_DEPLOY_OK_EVENT_TYPE = "deploy_ok";

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeString(value).trim();
}

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function firstText(...values) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return "";
}

function normalizeActor(actor = {}) {
  const safeActor = normalizePlainObject(actor);
  return {
    globalUserId: normalizeText(safeActor.globalUserId),
    platform: normalizeText(safeActor.platform) || "unknown",
    platformUserId: safeActor.platformUserId || null,
    role: normalizeText(safeActor.role) || "system",
    isMonarch: Boolean(safeActor.isMonarch),
  };
}

function normalizeInput({ sourceKind = "", event = {}, evidence = {}, actor = {}, context = {} } = {}) {
  const safeEvent = normalizePlainObject(event);
  const safeEvidence = normalizePlainObject(evidence);
  const safeContext = normalizePlainObject(context);
  const metadata = normalizePlainObject(safeEvent.metadata);

  return {
    sourceKind: firstText(sourceKind, safeEvidence.sourceKind, metadata.sourceKind, safeEvent.sourceKind, PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS.UNKNOWN),
    eventType: firstText(safeEvidence.eventType, safeEvidence.type, safeEvent.eventType, safeEvent.type),
    sourceRef: firstText(safeEvidence.sourceRef, safeEvent.sourceRef, metadata.sourceRef, safeContext.sourceRef),
    repositoryFullName: firstText(
      safeEvidence.repositoryFullName,
      safeEvidence.repoFullName,
      safeEvidence.repository,
      safeEvent.repositoryFullName,
      safeEvent.repoFullName,
      safeEvent.repository,
      metadata.repositoryFullName,
      metadata.repoFullName,
      metadata.repository,
      safeContext.repositoryFullName,
      safeContext.repoFullName,
      safeContext.repository,
    ),
    baseBranch: firstText(
      safeEvidence.baseBranch,
      safeEvidence.baseRef,
      safeEvidence.base,
      safeEvent.baseBranch,
      safeEvent.baseRef,
      safeEvent.base,
      metadata.baseBranch,
      metadata.baseRef,
      metadata.base,
      safeContext.baseBranch,
      safeContext.baseRef,
      safeContext.branch,
    ),
    headSha: firstText(
      safeEvidence.headSha,
      safeEvidence.mergeCommitSha,
      safeEvidence.sha,
      safeEvent.headSha,
      safeEvent.mergeCommitSha,
      safeEvent.sha,
      metadata.headSha,
      metadata.mergeCommitSha,
      metadata.sha,
      safeContext.headSha,
      safeContext.sha,
      safeContext.commitSha,
    ),
    verified: safeEvidence.verified === true || metadata.verified === true,
    deployOk: safeEvidence.deployOk === true || metadata.deployOk === true,
    logsClean: safeEvidence.logsClean === true || metadata.logsClean === true,
    actor: normalizeActor(actor),
  };
}

export function getProjectMemoryAutoConfirmationPolicyBoundaries() {
  return {
    transportIndependent: true,
    purePolicyEvaluationOnly: true,
    writesStorage: false,
    readsStorage: false,
    createsDurableCandidate: false,
    confirmsCandidates: false,
    writesConfirmedMemory: false,
    readsRawChat: false,
    callsAI: false,
    touchesTelegram: false,
    fetchesSources: false,
    sourceSync: false,
    promptInjection: false,
    modifiesRepository: false,
    writesRuntimeFiles: false,
  };
}

export function buildProjectMemoryAutoConfirmationPolicyStatus() {
  return {
    ok: true,
    module: "project_memory",
    service: "ProjectMemoryAutoConfirmationPolicy",
    version: PROJECT_MEMORY_AUTO_CONFIRMATION_POLICY_VERSION,
    mode: PROJECT_MEMORY_AUTO_CONFIRMATION_POLICY_MODES.PURE_POLICY_EVALUATION_ONLY,
    allowedRepositoryFullName: ALLOWED_REPOSITORY_FULL_NAME,
    allowedBaseBranch: ALLOWED_BASE_BRANCH,
    supportedSourceKinds: [
      PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS.GITHUB_PR_MERGED,
      PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS.RENDER_DEPLOY_LOGS,
    ],
    boundaries: getProjectMemoryAutoConfirmationPolicyBoundaries(),
  };
}

function createDecision({ allowed, reason, input, errors = [], warnings = [] }) {
  return {
    ok: true,
    version: PROJECT_MEMORY_AUTO_CONFIRMATION_POLICY_VERSION,
    mode: PROJECT_MEMORY_AUTO_CONFIRMATION_POLICY_MODES.PURE_POLICY_EVALUATION_ONLY,
    decision: allowed
      ? PROJECT_MEMORY_AUTO_CONFIRMATION_DECISIONS.ALLOW
      : PROJECT_MEMORY_AUTO_CONFIRMATION_DECISIONS.DENY,
    allowed,
    autoConfirm: allowed,
    reason,
    sourceKind: input.sourceKind,
    eventType: input.eventType,
    evidence: {
      sourceRef: input.sourceRef || null,
      repositoryFullName: input.repositoryFullName || null,
      baseBranch: input.baseBranch || null,
      headSha: input.headSha || null,
      verified: input.verified,
      deployOk: input.deployOk,
      logsClean: input.logsClean,
    },
    actor: input.actor,
    errors,
    warnings,
    boundaries: getProjectMemoryAutoConfirmationPolicyBoundaries(),
  };
}

function deny(reason, input, errors = []) {
  return createDecision({ allowed: false, reason, input, errors });
}

function allow(reason, input) {
  return createDecision({ allowed: true, reason, input });
}

function evaluateGithubPrMerged(input) {
  if (input.eventType && input.eventType !== GITHUB_PR_MERGED_EVENT_TYPE) {
    return deny(PROJECT_MEMORY_AUTO_CONFIRMATION_DENY_REASONS.AMBIGUOUS_EVENT, input, [{ code: "unsupported_github_event_type", eventType: input.eventType }]);
  }
  if (!input.sourceRef) {
    return deny(PROJECT_MEMORY_AUTO_CONFIRMATION_DENY_REASONS.MISSING_SOURCE_REF, input, [{ code: "missing_source_ref" }]);
  }
  if (input.repositoryFullName !== ALLOWED_REPOSITORY_FULL_NAME) {
    return deny(PROJECT_MEMORY_AUTO_CONFIRMATION_DENY_REASONS.WRONG_REPOSITORY, input, [{ code: "wrong_repository", expected: ALLOWED_REPOSITORY_FULL_NAME, actual: input.repositoryFullName || null }]);
  }
  if (input.baseBranch !== ALLOWED_BASE_BRANCH) {
    return deny(PROJECT_MEMORY_AUTO_CONFIRMATION_DENY_REASONS.WRONG_BRANCH, input, [{ code: "wrong_branch", expected: ALLOWED_BASE_BRANCH, actual: input.baseBranch || null }]);
  }
  if (!input.headSha) {
    return deny(PROJECT_MEMORY_AUTO_CONFIRMATION_DENY_REASONS.WEAK_EVIDENCE, input, [{ code: "missing_head_sha" }]);
  }

  return allow("github_pr_merged_trusted_allowlist_passed", input);
}

function evaluateRenderDeployLogs(input) {
  if (input.eventType && input.eventType !== RENDER_DEPLOY_OK_EVENT_TYPE) {
    return deny(PROJECT_MEMORY_AUTO_CONFIRMATION_DENY_REASONS.AMBIGUOUS_EVENT, input, [{ code: "unsupported_render_event_type", eventType: input.eventType }]);
  }
  if (!input.sourceRef) {
    return deny(PROJECT_MEMORY_AUTO_CONFIRMATION_DENY_REASONS.MISSING_SOURCE_REF, input, [{ code: "missing_source_ref" }]);
  }
  if (input.verified !== true || input.deployOk !== true || input.logsClean !== true) {
    return deny(PROJECT_MEMORY_AUTO_CONFIRMATION_DENY_REASONS.RENDER_EVIDENCE_NOT_VERIFIED, input, [{
      code: "render_evidence_not_verified_clean_deploy",
      verified: input.verified,
      deployOk: input.deployOk,
      logsClean: input.logsClean,
    }]);
  }

  return allow("render_deploy_logs_verified_clean_deploy_passed", input);
}

export function evaluateProjectMemoryAutoConfirmation({ sourceKind = "", event = {}, evidence = {}, actor = {}, context = {} } = {}) {
  const input = normalizeInput({ sourceKind, event, evidence, actor, context });

  if (input.sourceKind === PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS.RAW_CHAT) {
    return deny(PROJECT_MEMORY_AUTO_CONFIRMATION_DENY_REASONS.RAW_CHAT_SOURCE_DENIED, input, [{ code: "raw_chat_source_denied" }]);
  }
  if (!input.sourceKind || input.sourceKind === PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS.UNKNOWN) {
    return deny(PROJECT_MEMORY_AUTO_CONFIRMATION_DENY_REASONS.UNKNOWN_SOURCE_DENIED, input, [{ code: "unknown_source_denied" }]);
  }
  if (input.sourceKind === PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS.GITHUB_PR_MERGED) {
    return evaluateGithubPrMerged(input);
  }
  if (input.sourceKind === PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS.RENDER_DEPLOY_LOGS) {
    return evaluateRenderDeployLogs(input);
  }

  return deny(PROJECT_MEMORY_AUTO_CONFIRMATION_DENY_REASONS.UNKNOWN_SOURCE_DENIED, input, [{ code: "unsupported_source_kind", sourceKind: input.sourceKind }]);
}

export default {
  PROJECT_MEMORY_AUTO_CONFIRMATION_POLICY_VERSION,
  PROJECT_MEMORY_AUTO_CONFIRMATION_POLICY_MODES,
  PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS,
  PROJECT_MEMORY_AUTO_CONFIRMATION_DECISIONS,
  PROJECT_MEMORY_AUTO_CONFIRMATION_DENY_REASONS,
  buildProjectMemoryAutoConfirmationPolicyStatus,
  getProjectMemoryAutoConfirmationPolicyBoundaries,
  evaluateProjectMemoryAutoConfirmation,
};
