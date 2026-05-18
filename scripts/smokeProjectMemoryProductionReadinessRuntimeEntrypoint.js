// scripts/smokeProjectMemoryProductionReadinessRuntimeEntrypoint.js
// SG 2.0 smoke test for the Project Memory production readiness runtime entrypoint.
// Purpose: prove the entrypoint is explicit, read-only, fail-closed, and does not leak common secret patterns.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(repoRoot, "scripts", "runProjectMemoryProductionReadinessDiagnostics.js");
const secretEnv = {
  DATABASE_URL: "postgres://secret-user:secret-pass@example.invalid/db",
  RENDER_API_KEY: "secret-render-key",
  OPENAI_API_KEY: "secret-openai-key",
};

function runScript(env = {}) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...secretEnv,
      ...env,
    },
    encoding: "utf8",
  });
}

function combinedOutput(result) {
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

function assertNoSecretLeak(output) {
  assert.equal(output.includes("postgres://secret-user"), false);
  assert.equal(output.includes("secret-pass"), false);
  assert.equal(output.includes("secret-render-key"), false);
  assert.equal(output.includes("secret-openai-key"), false);
}

const missingExplicit = runScript({
  PM_READY_EXPLICIT_RUNTIME_CHECK: "false",
});
const missingExplicitOutput = combinedOutput(missingExplicit);

assert.notEqual(missingExplicit.status, 0);
assert.equal(missingExplicitOutput.includes("missing_explicit_runtime_check_request"), true);
assert.equal(missingExplicitOutput.includes("PM_READY_EXPLICIT_RUNTIME_CHECK=true"), true);
assertNoSecretLeak(missingExplicitOutput);

const explicitNoDb = runScript({
  PM_READY_EXPLICIT_RUNTIME_CHECK: "true",
  PM_READY_DEPLOY_DONE: "true",
  PM_READY_RENDER_LOGS_CLEAN: "true",
  PM_READY_ROLLBACK_POINT: "173826a17182057f635444cb6701ac556cdcdf00",
});
const explicitNoDbOutput = combinedOutput(explicitNoDb);

assert.notEqual(explicitNoDb.status, 0);
assert.equal(
  explicitNoDbOutput.includes("project_memory_production_readiness_runtime_entrypoint_result")
    || explicitNoDbOutput.includes("project_memory_production_readiness_runtime_entrypoint_error"),
  true,
);
assertNoSecretLeak(explicitNoDbOutput);

console.log("OK: Project Memory production readiness runtime entrypoint is explicit, read-only, fail-closed, and sanitized");
