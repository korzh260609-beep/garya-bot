// scripts/smokeUsersIdentityRegistryCheck.js
// SG 2.0 smoke test for users identity registry diagnostics.
// Purpose: prove the diagnostic is importable, safe, and returns a non-secret structured result.

import assert from "node:assert/strict";

import { runUsersIdentityRegistryCheck } from "../src/diagnostics/usersIdentityRegistryCheck.js";

const result = await runUsersIdentityRegistryCheck();

assert.equal(result.type, "users_identity_registry");
assert.equal(typeof result.ok, "boolean");
assert.equal(result.rawProviderUserIdExposed, false);
assert.equal(typeof result.summary, "string");
assert.ok(result.summary.length > 0);
assert.equal(Object.prototype.hasOwnProperty.call(result, "providerUserId"), false);

if (result.databaseConfigured) {
  assert.equal(result.durableModeChecked, true);
  assert.equal(result.stableGlobalUserId, true);
  assert.equal(result.globalUserIdShapeOk, true);
} else {
  assert.equal(result.fallbackSafe, true);
  assert.equal(result.monarchStable, true);
}

console.log(JSON.stringify(result, null, 2));
