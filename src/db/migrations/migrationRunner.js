// AGENT NOTE:
// SG 2.0 migration runner skeleton.
// Purpose: provide explicit, reviewable migration planning without mutating the database by default.
// Do not run migrations from startup, Telegram, AI, message handling, or Project Memory modules.

import { buildMigrationRecord, MIGRATION_STATUSES } from "./migrationTypes.js";
import { getRegisteredMigrations, validateMigrationRegistry } from "./migrationRegistry.js";

export function buildMigrationPlan({ registry } = {}) {
  const validation = validateMigrationRegistry({ registry });
  const migrations = getRegisteredMigrations({ registry });

  return {
    ok: validation.ok,
    type: "migration_plan",
    mode: "plan_only",
    willMutateDatabase: false,
    validation,
    migrations: migrations.map((migration) => buildMigrationRecord(migration)),
    rules: {
      noStartupExecution: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
      explicitApprovalRequired: true,
    },
  };
}

export async function runMigrationPlanOnly({ registry } = {}) {
  return buildMigrationPlan({ registry });
}

export async function runMigrations() {
  return {
    ok: false,
    type: "migration_run_result",
    status: MIGRATION_STATUSES.SKIPPED,
    reason: "migration_execution_not_implemented_in_skeleton",
    willMutateDatabase: false,
  };
}

export default {
  buildMigrationPlan,
  runMigrationPlanOnly,
  runMigrations,
};
