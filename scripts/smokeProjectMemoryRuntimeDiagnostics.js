// scripts/smokeProjectMemoryRuntimeDiagnostics.js
// SG 2.0 — Project Memory runtime diagnostics smoke.
// This smoke must stay deterministic, offline, and must not touch the real DB/network.

import assert from "node:assert/strict";
import { diagnosticsCheckRegistry } from "../src/agents/diagnostics-check-agent/diagnosticsCheckRegistry.js";
import { runProjectMemoryRuntimeCheck } from "../src/diagnostics/projectMemoryRuntimeCheck.js";

const OLD_ENV = {
  SG_PROJECT_MEMORY_CONTEXT_ENABLED: process.env.SG_PROJECT_MEMORY_CONTEXT_ENABLED,
  SG_PROJECT_MEMORY_PROMPT_INJECTION_ENABLED: process.env.SG_PROJECT_MEMORY_PROMPT_INJECTION_ENABLED,
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

try {
  delete process.env.SG_PROJECT_MEMORY_CONTEXT_ENABLED;
  delete process.env.SG_PROJECT_MEMORY_PROMPT_INJECTION_ENABLED;
  delete process.env.SG_PROJECT_MEMORY_SCHEMA_BOOTSTRAP_ENABLED;
  delete process.env.SG_PROJECT_MEMORY_SCHEMA_BOOTSTRAP_FAIL_STARTUP;
  delete process.env.DATABASE_URL;

  const result = runProjectMemoryRuntimeCheck();
  assert.equal(result.ok, true);
  assert.equal(result.type, "project_memory_runtime_check");
  assert.equal(result.sanitized, true);
  assert.equal(result.details.databaseConfigured, false);
  assert.equal(result.details.storageBoundaryAvailable, true);
  assert.equal(result.details.confirmationBoundaryAvailable, true);
  assert.equal(result.details.runtimeReadBridgeAvailable, true);
  assert.equal(result.details.schemaBootstrapEnabled, false);
  assert.equal(result.details.schemaBootstrapFailStartup, false);
  assert.equal(result.details.projectMemoryReadEnabled, false);
  assert.equal(result.details.promptInjectionEnabled, false);
  assert.equal(result.details.confirmationAutoWriteDisabled, true);
  assert.equal(result.details.runtimeContextWritesStorage, false);
  assert.equal(result.details.runtimeContextCallsAI, false);
  assert.equal(result.details.runtimeContextTouchesTelegram, false);
  assert.equal(result.details.runtimeContextInjectsPrompt, false);
  assert.deepEqual(result.warnings, []);

  process.env.SG_PROJECT_MEMORY_PROMPT_INJECTION_ENABLED = "true";
  const injectionWithoutRead = runProjectMemoryRuntimeCheck();
  assert.equal(injectionWithoutRead.ok, false);
  assert.equal(injectionWithoutRead.details.projectMemoryReadEnabled, false);
  assert.equal(injectionWithoutRead.details.promptInjectionEnabled, true);
  assert.ok(
    injectionWithoutRead.warnings.some((warning) => warning.code === "project_memory_prompt_injection_without_read"),
  );

  process.env.SG_PROJECT_MEMORY_CONTEXT_ENABLED = "true";
  process.env.SG_PROJECT_MEMORY_SCHEMA_BOOTSTRAP_ENABLED = "true";
  delete process.env.DATABASE_URL;
  const bootstrapWithoutDb = runProjectMemoryRuntimeCheck();
  assert.equal(bootstrapWithoutDb.ok, false);
  assert.equal(bootstrapWithoutDb.details.projectMemoryReadEnabled, true);
  assert.equal(bootstrapWithoutDb.details.promptInjectionEnabled, true);
  assert.equal(bootstrapWithoutDb.details.schemaBootstrapEnabled, true);
  assert.equal(bootstrapWithoutDb.details.databaseConfigured, false);
  assert.ok(
    bootstrapWithoutDb.warnings.some((warning) => warning.code === "project_memory_schema_bootstrap_without_database"),
  );

  const registryItem = diagnosticsCheckRegistry.find((item) => item.name === "project_memory_runtime");
  assert.ok(registryItem);
  const registryResult = await registryItem.run({});
  assert.equal(registryResult.type, "project_memory_runtime_check");
  assert.equal(typeof registryItem.summarize(registryResult), "string");
  assert.ok(registryItem.summarize(registryResult).includes("Project Memory runtime"));

  console.log("smokeProjectMemoryRuntimeDiagnostics: ok");
} finally {
  restoreEnv();
}
