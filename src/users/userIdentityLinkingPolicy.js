// AGENT NOTE:
// SG 2.0 user identity linking policy.
// Purpose: decide whether a provider identity may be linked to an existing globalUserId.
// This file is policy-only: no database writes, no transport behavior, no AI calls, no memory writes.

import { USER_ROLES, isDurableGlobalUserId } from "./globalIdentity.js";

export const IDENTITY_LINK_APPROVAL_METHODS = Object.freeze({
  MONARCH: "monarch",
  USER_PROOF: "user_proof",
  SYSTEM_MIGRATION: "system_migration",
});

export const IDENTITY_LINK_POLICY_REASONS = Object.freeze({
  ALLOWED: "identity_link_allowed",
  GLOBAL_USER_ID_INVALID: "global_user_id_invalid",
  PROVIDER_IDENTITY_INVALID: "provider_identity_invalid",
  CONFIRMATION_REQUIRED: "identity_link_confirmation_required",
  APPROVAL_METHOD_INVALID: "approval_method_invalid",
  APPROVER_NOT_ALLOWED: "identity_link_approver_not_allowed",
});

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRole(value) {
  return normalizeText(value).toLowerCase();
}

function isKnownApprovalMethod(value) {
  return Object.values(IDENTITY_LINK_APPROVAL_METHODS).includes(normalizeText(value));
}

function isProviderIdentityValid(providerIdentity = {}) {
  return Boolean(
    normalizeText(providerIdentity.provider)
      && normalizeText(providerIdentity.providerUserId)
      && normalizeText(providerIdentity.providerUserId) !== "unknown"
  );
}

function buildDecision({ allowed = false, reason, approvalMethod = null, policy = {} } = {}) {
  return {
    ok: allowed,
    type: "user_identity_link_policy_decision",
    allowed,
    reason,
    approvalMethod,
    policy: {
      requiresExplicitConfirmation: true,
      noAutoLinking: true,
      noRawProviderIdInReports: true,
      ...policy,
    },
  };
}

export function evaluateIdentityLinkPolicy({
  globalUserId,
  providerIdentity,
  confirmed = false,
  approvalMethod = "",
  approverRole = USER_ROLES.UNKNOWN,
} = {}) {
  if (!isDurableGlobalUserId(globalUserId)) {
    return buildDecision({ reason: IDENTITY_LINK_POLICY_REASONS.GLOBAL_USER_ID_INVALID });
  }

  if (!isProviderIdentityValid(providerIdentity)) {
    return buildDecision({ reason: IDENTITY_LINK_POLICY_REASONS.PROVIDER_IDENTITY_INVALID });
  }

  if (!confirmed) {
    return buildDecision({ reason: IDENTITY_LINK_POLICY_REASONS.CONFIRMATION_REQUIRED });
  }

  if (!isKnownApprovalMethod(approvalMethod)) {
    return buildDecision({ reason: IDENTITY_LINK_POLICY_REASONS.APPROVAL_METHOD_INVALID });
  }

  const normalizedApprovalMethod = normalizeText(approvalMethod);
  const normalizedApproverRole = normalizeRole(approverRole);

  if (normalizedApprovalMethod === IDENTITY_LINK_APPROVAL_METHODS.MONARCH
    && normalizedApproverRole !== USER_ROLES.MONARCH) {
    return buildDecision({
      reason: IDENTITY_LINK_POLICY_REASONS.APPROVER_NOT_ALLOWED,
      approvalMethod: normalizedApprovalMethod,
    });
  }

  return buildDecision({
    allowed: true,
    reason: IDENTITY_LINK_POLICY_REASONS.ALLOWED,
    approvalMethod: normalizedApprovalMethod,
  });
}

export default {
  IDENTITY_LINK_APPROVAL_METHODS,
  IDENTITY_LINK_POLICY_REASONS,
  evaluateIdentityLinkPolicy,
};
