// AGENT NOTE:
// SG 2.0 migration execution guard skeleton.
// Purpose: provide an explicit safety gate before any future migration execution path exists.
// Do not import postgresClient, run queries, write Project Memory, call AI, touch Telegram, or add startup execution here.

import { getMigrationRuntimeConfigFromEnv } from "./migrationRuntimeConfig.js";

export const MIGRATION_EXECUTION_GUARD_REASON = "migration_execution_requires_explicit_future_approval";

export function buildMigrationExecutionGuard(overrides = {}) {
  const runtimeConfig = overrides.runtimeConfig || getMigrationRuntimeConfigFromEnv();
  const runMigrationsOnBoot = Boolean(runtimeConfig?.env?.runMigrationsOnBoot?.enabled);

  return {
    ok: true,
    type: "migration_execution_guard",
    executionAllowed: false,
    reason: overrides.reason || MIGRATION_EXECUTION_GUARD_REASON,
    willMutateDatabase: false,
    runtimeConfig,
    env: {
      runMigrationsOnBoot,
      runMigrationsOnBootEnvKey: runtimeConfig?.env?.runMigrationsOnBoot?.key || "RUN_MIGRATIONS_ON_BOOT",
      existingEnvVariableUsed: true,
    },
    rules: {
      noDefaultExecution: true,
      noQueryExecution: true,
      noStartupExecution: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
      explicitApprovalRequired: true,
      envFlagAloneDoesNotBypassGuard: true,
      ...(overrides.rules || {}),
    },
  };
}

export function assertMigrationExecutionBlocked(overrides = {}) {
  const guard = buildMigrationExecutionGuard(overrides);

  return {
    ok: guard.ok && guard.executionAllowed === false,
    type: "migration_execution_block_assertion",
    blocked: guard.executionAllowed === false,
    guard,
  };
}

export default {
  MIGRATION_EXECUTION_GUARD_REASON,
  buildMigrationExecutionGuard,
  assertMigrationExecutionBlocked,
};
