// scripts/smokeUserIdentityLinkRequests.js
// SG 2.0 smoke test for user identity link request boundary.
// Purpose: prove pending link requests are deterministic, explicit, and non-secret in reports.

import assert from "node:assert/strict";

import {
  IDENTITY_LINK_REQUEST_STATUSES,
  buildIdentityLinkRequestCandidate,
  buildIdentityLinkRequestId,
} from "../src/users/userIdentityLinkRequests.js";

const providerIdentity = {
  provider: "api",
  providerUserId: "smoke_identity_link_request_user",
};

const requestId = buildIdentityLinkRequestId({
  providerIdentity,
  targetGlobalUserId: "usr_48cc07c069030fb3",
});

assert.equal(requestId.startsWith("ilr_"), true);
assert.equal(requestId.length, 28);

const sameRequestId = buildIdentityLinkRequestId({
  providerIdentity,
  targetGlobalUserId: "usr_48cc07c069030fb3",
});

assert.equal(sameRequestId, requestId);

const candidate = buildIdentityLinkRequestCandidate({
  provider: "api",
  providerUserId: "smoke_identity_link_request_user",
  targetGlobalUserId: "usr_48cc07c069030fb3",
  requestedByGlobalUserId: "usr_48cc07c069030fb3",
  metadata: {
    source: "smokeUserIdentityLinkRequests",
  },
});

assert.equal(candidate.ok, true);
assert.equal(candidate.type, "user_identity_link_request_candidate");
assert.equal(candidate.requestId, requestId);
assert.equal(candidate.providerIdentity.provider, "api");
assert.equal(candidate.targetGlobalUserId, "usr_48cc07c069030fb3");
assert.equal(candidate.rules.status, IDENTITY_LINK_REQUEST_STATUSES.PENDING);
assert.equal(candidate.rules.requiresExplicitConfirmation, true);
assert.equal(candidate.rules.noAutoLinking, true);
assert.equal(candidate.rules.noTransportSpecificBehavior, true);
assert.equal(candidate.rules.noRawProviderIdInReports, true);
assert.equal(Object.prototype.hasOwnProperty.call(candidate, "providerUserId"), false);

const invalidCandidate = buildIdentityLinkRequestCandidate({
  provider: "api",
  providerUserId: "unknown",
  targetGlobalUserId: "usr_48cc07c069030fb3",
});

assert.equal(invalidCandidate.ok, false);
assert.equal(invalidCandidate.rules.noAutoLinking, true);

console.log("OK: user identity link requests are pending-gated and non-secret");
