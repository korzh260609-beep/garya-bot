// AGENT NOTE:
// SG 2.0 migration registry skeleton.
// Purpose: register reviewable migration definitions without running them automatically.
// Do not add hidden startup execution, schema bootstrap coupling, Project Memory writes, AI calls, or transport logic here.

import { projectMemoryCoreMigration } from "./definitions/001_project_memory_core.js";
import { isValidMigrationDefinition } from "./migrationTypes.js";

export const migrationRegistry = Object.freeze([
  projectMemoryCoreMigration,
]);

export function getRegisteredMigrations({ registry = migrationRegistry } = {}) {
  return Array.isArray(registry) ? [...registry] : [];
}

export function validateMigrationRegistry({ registry = migrationRegistry } = {}) {
  const migrations = getRegisteredMigrations({ registry });
  const seen = new Set();
  const errors = [];

  migrations.forEach((migration, index) => {
    if (!isValidMigrationDefinition(migration)) {
      errors.push({
        index,
        id: migration?.id || null,
        reason: "invalid_migration_definition",
      });
      return;
    }

    if (seen.has(migration.id)) {
      errors.push({
        index,
        id: migration.id,
        reason: "duplicate_migration_id",
      });
      return;
    }

    seen.add(migration.id);
  });

  return {
    ok: errors.length === 0,
    type: "migration_registry_validation",
    count: migrations.length,
    errors,
  };
}

export default {
  migrationRegistry,
  getRegisteredMigrations,
  validateMigrationRegistry,
};
