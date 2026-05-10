// scripts/smokeUsersIdentityLinkRequestsCheck.js
// SG 2.0 smoke test for users identity link requests diagnostics.
// Purpose: prove the diagnostic is importable, safe, deterministic, and does not write provider links or pending requests.

import assert from "node:assert/strict";

import { runUsersIdentityLinkRequestsCheck } from "../src/diagnostics/usersIdentityLinkRequestsCheck.js";

const result = await runUsersIdentityLinkRequestsCheck();

assert.equal(result.type, "users_identity_link_requests");
assert.equal(result.ok, true);
assert.equal(result.requestIdDeterministic, true);
assert.equal(result.candidateValid, true);
assert.equal(result.pendingByDefault, true);
assert.equal(result.explicitConfirmationRequired, true);
assert.equal(result.autoLinkingBlocked, true);
assert.equal(result.noWriteAttempted, true);
assert.equal(result.rawProviderUserIdExposed, false);
assert.equal(Object.prototype.hasOwnProperty.call(result, "providerUserId"), false);

console.log(JSON.stringify(result, null, 2));
