// scripts/smokeUsersIdentityLinkingCheck.js
// SG 2.0 smoke test for users identity linking diagnostics.
// Purpose: prove the diagnostic is importable, safe, and does not write provider links.

import assert from "node:assert/strict";

import { runUsersIdentityLinkingCheck } from "../src/diagnostics/usersIdentityLinkingCheck.js";

const result = await runUsersIdentityLinkingCheck();

assert.equal(result.type, "users_identity_linking");
assert.equal(result.ok, true);
assert.equal(result.candidateValid, true);
assert.equal(result.confirmationRequired, true);
assert.equal(result.autoLinkingBlocked, true);
assert.equal(result.noWriteAttempted, true);
assert.equal(result.rawProviderUserIdExposed, false);
assert.equal(Object.prototype.hasOwnProperty.call(result, "providerUserId"), false);

console.log(JSON.stringify(result, null, 2));
