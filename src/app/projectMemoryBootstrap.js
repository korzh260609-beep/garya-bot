// src/app/projectMemoryBootstrap.js
// SG 2.0 — Project Memory schema bootstrap boundary.
//
// Purpose:
// - Ensure Project Memory storage tables exist when explicitly enabled.
// - Keep bootstrap separate from runtime hooks, server startup, Telegram, AI, and message flow.
//
// Hard rules:
// - Do not write memory entries here.
// - Do not confirm candidates here.
// - Do not read Project Memory context here.
// - Do not call AI here.
// - Do not touch Telegram or transport logic here.
// - Do not fetch sources here.
// - Do not fail process startup by default if bootstrap fails.

import { envBool } from "../config/env.js";
import { isDatabaseConfigured } from "../db/postgresClient.js";
import { ensureProjectMemorySchema } from "../memory/index.js";

export const PROJECT_MEMORY_SCHEMA_BOOTSTRAP_VERSION = 1;

export const PROJECT_MEMORY_SCHEMA_BOOTSTRAP_MODES = Object.freeze({
  DISABLED: "disabled",
  ENSURE_SCHEMA: "ensure_schema",
});

export function getProjectMemorySchemaBootstrapOptionsFromEnv() {
  return {
    enabled: envBool("SG_PROJECT_MEMORY_SCHEMA_BOOTSTRAP_ENABLED", false),
    failStartupOnError: envBool("SG_PROJECT_MEMORY_SCHEMA_BOOTSTRAP_FAIL_STARTUP", false),
  };
}

export async function bootstrapProjectMemorySchema({ options = null, logger = console } = {}) {
  const normalizedOptions = options || getProjectMemorySchemaBootstrapOptionsFromEnv();

  if (!normalizedOptions.enabled) {
    return {
      ok: true,
      version: PROJECT_MEMORY_SCHEMA_BOOTSTRAP_VERSION,
      mode: PROJECT_MEMORY_SCHEMA_BOOTSTRAP_MODES.DISABLED,
      attempted: false,
      databaseConfigured: isDatabaseConfigured(),
      failedStartup: false,
    };
  }

  if (!isDatabaseConfigured()) {
    const result = {
      ok: false,
      version: PROJECT_MEMORY_SCHEMA_BOOTSTRAP_VERSION,
      mode: PROJECT_MEMORY_SCHEMA_BOOTSTRAP_MODES.ENSURE_SCHEMA,
      attempted: false,
      databaseConfigured: false,
      reason: "database_not_configured",
      failedStartup: Boolean(normalizedOptions.failStartupOnError),
    };

    if (result.failedStartup) {
      throw new Error("Project Memory schema bootstrap failed: database_not_configured");
    }

    logger?.warn?.("Project Memory schema bootstrap skipped: database_not_configured");
    return result;
  }

  try {
    const ensured = await ensureProjectMemorySchema();

    if (!ensured.ok && normalizedOptions.failStartupOnError) {
      throw new Error(`Project Memory schema bootstrap failed: ${ensured.reason || "ensure_schema_failed"}`);
    }

    if (!ensured.ok) {
      logger?.warn?.("Project Memory schema bootstrap failed", {
        reason: ensured.reason || "ensure_schema_failed",
      });
    }

    return {
      ok: Boolean(ensured.ok),
      version: PROJECT_MEMORY_SCHEMA_BOOTSTRAP_VERSION,
      mode: PROJECT_MEMORY_SCHEMA_BOOTSTRAP_MODES.ENSURE_SCHEMA,
      attempted: true,
      databaseConfigured: true,
      failedStartup: false,
      result: ensured,
      reason: ensured.ok ? null : ensured.reason || "ensure_schema_failed",
    };
  } catch (error) {
    if (normalizedOptions.failStartupOnError) {
      throw error;
    }

    logger?.warn?.("Project Memory schema bootstrap threw", {
      reason: error?.message || "project_memory_schema_bootstrap_failed",
    });

    return {
      ok: false,
      version: PROJECT_MEMORY_SCHEMA_BOOTSTRAP_VERSION,
      mode: PROJECT_MEMORY_SCHEMA_BOOTSTRAP_MODES.ENSURE_SCHEMA,
      attempted: true,
      databaseConfigured: true,
      failedStartup: false,
      reason: error?.message || "project_memory_schema_bootstrap_failed",
    };
  }
}

export default {
  PROJECT_MEMORY_SCHEMA_BOOTSTRAP_VERSION,
  PROJECT_MEMORY_SCHEMA_BOOTSTRAP_MODES,
  getProjectMemorySchemaBootstrapOptionsFromEnv,
  bootstrapProjectMemorySchema,
};
