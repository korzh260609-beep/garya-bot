// scripts/smokeUserIdentityLinking.js
// SG 2.0 smoke test for user identity linking skeleton.
// Purpose: prove identity linking boundary is importable, policy-gated, and non-secret in reports.

import assert from "node:assert/strict";

import {
  buildUserIdentityLinkCandidate,
  linkProviderIdentityToGlobalUser,
} from "../src/users/userIdentityLinking.js";
import { IDENTITY_LINK_APPROVAL_METHODS } from "../src/users/userIdentityLinkingPolicy.js";
import { USER_ROLES } from "../src/users/globalIdentity.js";

const candidate = buildUserIdentityLinkCandidate({
  provider: "api",
  providerUserId: "smoke_identity_linking_user",
  globalUserId: "usr_48cc07c069030fb3",
  metadata: {
    source: "smokeUserIdentityLinking",
  },
});

assert.equal(candidate.ok, true);
assert.equal(candidate.type, "user_identity_link_candidate");
assert.equal(candidate.globalUserId, "usr_48cc07c069030fb3");
assert.equal(candidate.providerIdentity.provider, "api");
assert.equal(candidate.rules.requiresExplicitConfirmation, true);
assert.equal(candidate.rules.noAutoLinking, true);
assert.equal(candidate.rules.noRawProviderIdInReports, true);

const unconfirmedRejected = await linkProviderIdentityToGlobalUser({
  provider: "api",
  providerUserId: "smoke_identity_linking_user",
  globalUserId: "usr_48cc07c069030fb3",
  metadata: {
    source: "smokeUserIdentityLinking",
  },
  confirmed: false,
  approvalMethod: IDENTITY_LINK_APPROVAL_METHODS.MONARCH,
  approverRole: USER_ROLES.MONARCH,
});

assert.equal(unconfirmedRejected.ok, false);
assert.equal(unconfirmedRejected.reason, "identity_link_confirmation_required");
assert.equal(Object.prototype.hasOwnProperty.call(unconfirmedRejected, "providerUserId"), false);

const missingPolicyRejected = await linkProviderIdentityToGlobalUser({
  provider: "api",
  providerUserId: "smoke_identity_linking_user",
  globalUserId: "usr_48cc07c069030fb3",
  metadata: {
    source: "smokeUserIdentityLinking",
  },
  confirmed: true,
});

assert.equal(missingPolicyRejected.ok, false);
assert.equal(missingPolicyRejected.reason, "approval_method_invalid");
assert.equal(Object.prototype.hasOwnProperty.call(missingPolicyRejected, "providerUserId"), false);

const guestPolicyRejected = await linkProviderIdentityToGlobalUser({
  provider: "api",
  providerUserId: "smoke_identity_linking_user",
  globalUserId: "usr_48cc07c069030fb3",
  metadata: {
    source: "smokeUserIdentityLinking",
  },
  confirmed: true,
  approvalMethod: IDENTITY_LINK_APPROVAL_METHODS.MONARCH,
  approverRole: USER_ROLES.GUEST,
});

assert.equal(guestPolicyRejected.ok, false);
assert.equal(guestPolicyRejected.reason, "identity_link_approver_not_allowed");
assert.equal(Object.prototype.hasOwnProperty.call(guestPolicyRejected, "providerUserId"), false);

console.log("OK: user identity linking skeleton is policy-gated and non-secret");
