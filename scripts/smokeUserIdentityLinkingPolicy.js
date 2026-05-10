// scripts/smokeUserIdentityLinkingPolicy.js
// SG 2.0 smoke test for user identity linking policy.
// Purpose: prove linking requires confirmation and allowed approval policy.

import assert from "node:assert/strict";

import {
  IDENTITY_LINK_APPROVAL_METHODS,
  IDENTITY_LINK_POLICY_REASONS,
  evaluateIdentityLinkPolicy,
} from "../src/users/userIdentityLinkingPolicy.js";
import { USER_ROLES } from "../src/users/globalIdentity.js";

const providerIdentity = {
  provider: "api",
  providerUserId: "smoke_policy_user",
};

const unconfirmed = evaluateIdentityLinkPolicy({
  globalUserId: "usr_48cc07c069030fb3",
  providerIdentity,
  confirmed: false,
  approvalMethod: IDENTITY_LINK_APPROVAL_METHODS.MONARCH,
  approverRole: USER_ROLES.MONARCH,
});

assert.equal(unconfirmed.allowed, false);
assert.equal(unconfirmed.reason, IDENTITY_LINK_POLICY_REASONS.CONFIRMATION_REQUIRED);
assert.equal(unconfirmed.policy.requiresExplicitConfirmation, true);
assert.equal(unconfirmed.policy.noAutoLinking, true);
assert.equal(unconfirmed.policy.noRawProviderIdInReports, true);

const guestApproval = evaluateIdentityLinkPolicy({
  globalUserId: "usr_48cc07c069030fb3",
  providerIdentity,
  confirmed: true,
  approvalMethod: IDENTITY_LINK_APPROVAL_METHODS.MONARCH,
  approverRole: USER_ROLES.GUEST,
});

assert.equal(guestApproval.allowed, false);
assert.equal(guestApproval.reason, IDENTITY_LINK_POLICY_REASONS.APPROVER_NOT_ALLOWED);

const monarchApproval = evaluateIdentityLinkPolicy({
  globalUserId: "usr_48cc07c069030fb3",
  providerIdentity,
  confirmed: true,
  approvalMethod: IDENTITY_LINK_APPROVAL_METHODS.MONARCH,
  approverRole: USER_ROLES.MONARCH,
});

assert.equal(monarchApproval.allowed, true);
assert.equal(monarchApproval.reason, IDENTITY_LINK_POLICY_REASONS.ALLOWED);
assert.equal(monarchApproval.approvalMethod, IDENTITY_LINK_APPROVAL_METHODS.MONARCH);
assert.equal(Object.prototype.hasOwnProperty.call(monarchApproval, "providerUserId"), false);

console.log("OK: user identity linking policy is confirmation-gated and monarch-gated");
