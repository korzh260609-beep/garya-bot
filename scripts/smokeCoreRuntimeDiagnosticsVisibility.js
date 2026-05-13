// scripts/smokeCoreRuntimeDiagnosticsVisibility.js
// SG 2.0 — Core runtime diagnostics visibility smoke.
// This smoke must stay deterministic, offline, and must not touch DB/network/AI/Telegram/runtime files.
//
// Purpose:
// - Prove core/runtime diagnostics are exposed through the public boundary.
// - Prove diagnostics visibility reports runtime resolver safety boundaries.
// - Prove diagnostics do not enable features or depend on transport/user text.

import assert from "node:assert/strict";
import {
  CORE_RUNTIME_DIAGNOSTICS_VERSION,
  buildCoreRuntimeDiagnostics,
  getCoreRuntimeModuleStatus,
} from "../src/core/runtime/index.js";

assert.equal(typeof CORE_RUNTIME_DIAGNOSTICS_VERSION, "number");
assert.equal(typeof buildCoreRuntimeDiagnostics, "function");
assert.equal(typeof getCoreRuntimeModuleStatus, "function");

const moduleStatus = getCoreRuntimeModuleStatus();
assert.equal(moduleStatus.ok, true);
assert.equal(moduleStatus.module, "core/runtime");
assert.equal(moduleStatus.hasDiagnosticsVisibility, true);
assert.equal(moduleStatus.transportIndependent, true);
assert.equal(moduleStatus.hasTransportLogic, false);
assert.equal(moduleStatus.hasAICalls, false);
assert.equal(moduleStatus.hasProjectMemoryReads, false);
assert.equal(moduleStatus.hasProjectMemoryWrites, false);
assert.equal(moduleStatus.hasPromptInjection, false);

const diagnostics = buildCoreRuntimeDiagnostics();
assert.equal(diagnostics.ok, true);
assert.equal(diagnostics.type, "core_runtime_diagnostics");
assert.equal(diagnostics.version, CORE_RUNTIME_DIAGNOSTICS_VERSION);
assert.equal(diagnostics.summary, "Core runtime diagnostics OK.");
assert.equal(Array.isArray(diagnostics.checks), true);
assert.equal(diagnostics.checks.length, 9);
assert.equal(Array.isArray(diagnostics.failedChecks), true);
assert.equal(diagnostics.failedChecks.length, 0);

for (const check of diagnostics.checks) {
  assert.equal(check.ok, true, `Expected diagnostic check to pass: ${check.name}`);
}

const checkNames = diagnostics.checks.map((check) => check.name);
assert.equal(checkNames.includes("core_runtime_public_boundary_ready"), true);
assert.equal(checkNames.includes("core_runtime_diagnostics_visibility_ready"), true);
assert.equal(checkNames.includes("core_runtime_transport_independent"), true);
assert.equal(checkNames.includes("core_runtime_no_transport_logic"), true);
assert.equal(checkNames.includes("core_runtime_no_ai_calls"), true);
assert.equal(checkNames.includes("core_runtime_no_project_memory_writes"), true);
assert.equal(checkNames.includes("core_runtime_no_prompt_injection"), true);
assert.equal(checkNames.includes("core_runtime_no_natural_language_inference"), true);
assert.equal(checkNames.includes("core_runtime_access_behavior_before_resolution"), true);

assert.equal(diagnostics.policy.deterministic, true);
assert.equal(diagnostics.policy.transportIndependent, true);
assert.equal(diagnostics.policy.noAICalls, true);
assert.equal(diagnostics.policy.noProjectMemoryReads, true);
assert.equal(diagnostics.policy.noProjectMemoryWrites, true);
assert.equal(diagnostics.policy.noPromptInjection, true);
assert.equal(diagnostics.policy.noNaturalLanguageInference, true);
assert.equal(diagnostics.policy.noRuntimeFeatureEnablement, true);

assert.equal(diagnostics.moduleStatus.hasDiagnosticsVisibility, true);
assert.equal(diagnostics.resolverBoundaries.transportIndependent, true);
assert.equal(diagnostics.resolverBoundaries.infersFromNaturalLanguage, false);
assert.equal(diagnostics.resolverBoundaries.callsAI, false);
assert.equal(diagnostics.resolverBoundaries.writesProjectMemory, false);
assert.equal(diagnostics.resolverBoundaries.injectsPromptContext, false);

console.log("smokeCoreRuntimeDiagnosticsVisibility: ok");
