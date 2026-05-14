// AGENT NOTE:
// SG 2.0 migration execution guard skeleton.
// Purpose: provide an explicit safety gate before any future migration execution path exists.
// Do not import postgresClient, run queries, write Project Memory, call AI, touch Telegram, or add startup execution here.

export const MIGRATION_EXECUTION_GUARD_REASON = "migration_execution_requires_explicit_future_approval";

export function buildMigrationExecutionGuard(overrides = {}) {
  return {
    ok: true,
    type: "migration_execution_guard",
    executionAllowed: false,
    reason: overrides.reason || MIGRATION_EXECUTION_GUARD_REASON,
    willMutateDatabase: false,
    rules: {
      noDefaultExecution: true,
      noQueryExecution: true,
      noStartupExecution: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
      explicitApprovalRequired: true,
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
