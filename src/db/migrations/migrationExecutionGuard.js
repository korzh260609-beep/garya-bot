// SG 2.0 migration execution guard.
// Purpose: decide if migration execution is allowed by runtime config.
// This module only reads config and returns a decision.

import { getMigrationRuntimeConfigFromEnv } from "./migrationRuntimeConfig.js";

export const MIGRATION_EXECUTION_GUARD_REASON = "migration_execution_requires_runtime_gates";

export function buildMigrationExecutionGuard(overrides = {}) {
  const runtimeConfig = overrides.runtimeConfig || getMigrationRuntimeConfigFromEnv();
  const runMigrationsOnBoot = Boolean(runtimeConfig?.env?.runMigrationsOnBoot?.enabled);
  const approveMigrationsOnBoot = Boolean(runtimeConfig?.env?.approveMigrationsOnBoot?.enabled);
  const executionAllowed = Boolean(
    overrides.executionAllowed === true
    || (runMigrationsOnBoot && approveMigrationsOnBoot),
  );

  return {
    ok: true,
    type: "migration_execution_guard",
    executionAllowed,
    reason: overrides.reason || (
      executionAllowed
        ? "migration_execution_runtime_gates_passed"
        : MIGRATION_EXECUTION_GUARD_REASON
    ),
    willMutateDatabase: false,
    runtimeConfig,
    env: {
      runMigrationsOnBoot,
      approveMigrationsOnBoot,
      runMigrationsOnBootEnvKey: runtimeConfig?.env?.runMigrationsOnBoot?.key || "RUN_MIGRATIONS_ON_BOOT",
      approveMigrationsOnBootEnvKey: runtimeConfig?.env?.approveMigrationsOnBoot?.key || "APPROVE_MIGRATIONS_ON_BOOT",
    },
    rules: {
      noDefaultExecution: true,
      noQueryExecution: true,
      noStartupExecution: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
      runGateRequired: true,
      approvalGateRequired: true,
      bothGatesRequired: true,
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
