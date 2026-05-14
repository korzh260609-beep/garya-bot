// scripts/smokeMigrationExecutionControllerSkeleton.js
// SG 2.0 smoke test for migration execution controller skeleton.
// Purpose: prove migration execution decisions are explicit and non-mutating.

import assert from "node:assert/strict";

import {
  MIGRATION_EXECUTION_DECISIONS,
  buildMigrationExecutionDecision,
} from "../src/db/migrations/migrationExecutionController.js";

const envDisabled = buildMigrationExecutionDecision({
  runtimeConfig: {
    ok: true,
    env: {
      runMigrationsOnBoot: {
        key: "RUN_MIGRATIONS_ON_BOOT",
        configured: true,
        enabled: false,
      },
    },
  },
  databaseConfigured: true,
});

assert.equal(envDisabled.ok, true);
assert.equal(envDisabled.type, "migration_execution_decision");
assert.equal(envDisabled.mode, "decision_only");
assert.equal(envDisabled.decision, MIGRATION_EXECUTION_DECISIONS.SKIP_ENV_DISABLED);
assert.equal(envDisabled.reason, "RUN_MIGRATIONS_ON_BOOT_disabled");
assert.equal(envDisabled.willMutateDatabase, false);
assert.equal(envDisabled.rules.noSqlExecution, true);
assert.equal(envDisabled.rules.noDbMutation, true);
assert.equal(envDisabled.rules.noStartupExecution, true);
assert.equal(envDisabled.runnerPlan.migrationCount, 1);

const envEnabledGuardBlocked = buildMigrationExecutionDecision({
  runtimeConfig: {
    ok: true,
    env: {
      runMigrationsOnBoot: {
        key: "RUN_MIGRATIONS_ON_BOOT",
        configured: true,
        enabled: true,
      },
    },
  },
  databaseConfigured: true,
});

assert.equal(envEnabledGuardBlocked.decision, MIGRATION_EXECUTION_DECISIONS.BLOCKED_BY_GUARD);
assert.equal(envEnabledGuardBlocked.guard.executionAllowed, false);
assert.equal(envEnabledGuardBlocked.willMutateDatabase, false);
assert.equal(envEnabledGuardBlocked.rules.envFlagAloneDoesNotBypassGuard, true);

const envEnabledGuardAllowedNoDb = buildMigrationExecutionDecision({
  runtimeConfig: {
    ok: true,
    env: {
      runMigrationsOnBoot: {
        key: "RUN_MIGRATIONS_ON_BOOT",
        configured: true,
        enabled: true,
      },
    },
  },
  guard: {
    ok: true,
    executionAllowed: true,
    reason: "test_guard_allows_future_path",
    willMutateDatabase: false,
    env: {
      runMigrationsOnBoot: true,
      runMigrationsOnBootEnvKey: "RUN_MIGRATIONS_ON_BOOT",
      existingEnvVariableUsed: true,
    },
  },
  databaseConfigured: false,
});

assert.equal(envEnabledGuardAllowedNoDb.decision, MIGRATION_EXECUTION_DECISIONS.BLOCKED_DATABASE_NOT_CONFIGURED);
assert.equal(envEnabledGuardAllowedNoDb.reason, "database_not_configured");
assert.equal(envEnabledGuardAllowedNoDb.guard.executionAllowed, true);
assert.equal(envEnabledGuardAllowedNoDb.database.configured, false);
assert.equal(envEnabledGuardAllowedNoDb.willMutateDatabase, false);

console.log("OK: migration execution controller is decision-only and non-mutating");
