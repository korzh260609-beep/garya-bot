// AGENT NOTE:
// SG 2.0 migration types boundary.
// Purpose: define stable migration metadata and statuses without executing database changes.
// Do not add PostgreSQL client logic, Project Memory writes, AI calls, transport logic, or hidden startup execution here.

export const MIGRATION_STATUSES = Object.freeze({
  PENDING: "pending",
  APPLIED: "applied",
  FAILED: "failed",
  SKIPPED: "skipped",
});

export const MIGRATION_DIRECTIONS = Object.freeze({
  UP: "up",
  DOWN: "down",
});

export function normalizeMigrationId(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function isValidMigrationDefinition(migration = {}) {
  return Boolean(
    normalizeMigrationId(migration.id)
    && typeof migration.name === "string"
    && migration.name.trim()
    && Array.isArray(migration.upSql)
  );
}

export function buildMigrationRecord(migration = {}, overrides = {}) {
  return {
    id: normalizeMigrationId(migration.id),
    name: String(migration.name || "").trim(),
    module: String(migration.module || "core").trim(),
    status: overrides.status || MIGRATION_STATUSES.PENDING,
    direction: overrides.direction || MIGRATION_DIRECTIONS.UP,
    sqlCount: Array.isArray(migration.upSql) ? migration.upSql.length : 0,
    appliedAt: overrides.appliedAt || null,
    error: overrides.error || null,
  };
}

export default {
  MIGRATION_STATUSES,
  MIGRATION_DIRECTIONS,
  normalizeMigrationId,
  isValidMigrationDefinition,
  buildMigrationRecord,
};
