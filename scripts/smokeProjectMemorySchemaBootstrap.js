// scripts/smokeProjectMemorySchemaBootstrap.js
// SG 2.0 — Project Memory schema bootstrap smoke.
// This smoke must stay deterministic, offline, and must not touch the real DB/network.

import assert from "node:assert/strict";
import {
  PROJECT_MEMORY_SCHEMA_BOOTSTRAP_MODES,
  bootstrapProjectMemorySchema,
  getProjectMemorySchemaBootstrapOptionsFromEnv,
} from "../src/app/index.js";

const OLD_ENV = {
  SG_PROJECT_MEMORY_SCHEMA_BOOTSTRAP_ENABLED: process.env.SG_PROJECT_MEMORY_SCHEMA_BOOTSTRAP_ENABLED,
  SG_PROJECT_MEMORY_SCHEMA_BOOTSTRAP_FAIL_STARTUP: process.env.SG_PROJECT_MEMORY_SCHEMA_BOOTSTRAP_FAIL_STARTUP,
  DATABASE_URL: process.env.DATABASE_URL,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(OLD_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

const logger = {
  warnings: [],
  warn(message, metadata = {}) {
    this.warnings.push({ message, metadata });
  },
};

try {
  delete process.env.SG_PROJECT_MEMORY_SCHEMA_BOOTSTRAP_ENABLED;
  delete process.env.SG_PROJECT_MEMORY_SCHEMA_BOOTSTRAP_FAIL_STARTUP;
  delete process.env.DATABASE_URL;

  const defaultOptions = getProjectMemorySchemaBootstrapOptionsFromEnv();
  assert.equal(defaultOptions.enabled, false);
  assert.equal(defaultOptions.failStartupOnError, false);

  const disabled = await bootstrapProjectMemorySchema({ logger });
  assert.equal(disabled.ok, true);
  assert.equal(disabled.mode, PROJECT_MEMORY_SCHEMA_BOOTSTRAP_MODES.DISABLED);
  assert.equal(disabled.attempted, false);
  assert.equal(disabled.databaseConfigured, false);
  assert.equal(disabled.failedStartup, false);

  process.env.SG_PROJECT_MEMORY_SCHEMA_BOOTSTRAP_ENABLED = "true";
  const enabledNoDbOptions = getProjectMemorySchemaBootstrapOptionsFromEnv();
  assert.equal(enabledNoDbOptions.enabled, true);
  assert.equal(enabledNoDbOptions.failStartupOnError, false);

  const enabledNoDb = await bootstrapProjectMemorySchema({ logger });
  assert.equal(enabledNoDb.ok, false);
  assert.equal(enabledNoDb.mode, PROJECT_MEMORY_SCHEMA_BOOTSTRAP_MODES.ENSURE_SCHEMA);
  assert.equal(enabledNoDb.attempted, false);
  assert.equal(enabledNoDb.databaseConfigured, false);
  assert.equal(enabledNoDb.reason, "database_not_configured");
  assert.equal(enabledNoDb.failedStartup, false);
  assert.ok(logger.warnings.some((entry) => entry.message.includes("database_not_configured")));

  process.env.SG_PROJECT_MEMORY_SCHEMA_BOOTSTRAP_FAIL_STARTUP = "true";
  let threw = false;
  try {
    await bootstrapProjectMemorySchema({ logger });
  } catch (error) {
    threw = true;
    assert.ok(String(error?.message || "").includes("database_not_configured"));
  }
  assert.equal(threw, true);

  console.log("smokeProjectMemorySchemaBootstrap: ok");
} finally {
  restoreEnv();
}
