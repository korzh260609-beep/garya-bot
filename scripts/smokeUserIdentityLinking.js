// scripts/smokeUserIdentityLinking.js
// SG 2.0 smoke test for user identity linking skeleton.
// Purpose: prove identity linking boundary is importable, confirmation-gated, and non-secret in reports.

import assert from "node:assert/strict";

import {
  buildUserIdentityLinkCandidate,
  linkProviderIdentityToGlobalUser,
} from "../src/users/userIdentityLinking.js";

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

const rejected = await linkProviderIdentityToGlobalUser({
  provider: "api",
  providerUserId: "smoke_identity_linking_user",
  globalUserId: "usr_48cc07c069030fb3",
  metadata: {
    source: "smokeUserIdentityLinking",
  },
  confirmed: false,
});

assert.equal(rejected.ok, false);
assert.equal(rejected.reason, "identity_link_confirmation_required");
assert.equal(Object.prototype.hasOwnProperty.call(rejected, "providerUserId"), false);

console.log("OK: user identity linking skeleton is confirmation-gated and non-secret");
