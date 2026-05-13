// src/core/runtime/runtimeDiagnostics.js
// SG 2.0 — Core Runtime Diagnostics Visibility.
//
// Purpose:
// - Build a deterministic diagnostics snapshot for the core/runtime boundary.
// - Expose runtime resolver and public boundary readiness without touching transports.
// - Keep runtime visibility separate from AI, Project Memory reads/writes, and prompt injection.
//
// Hard rules:
// - Do not add transport-specific logic here.
// - Do not read or write Project Memory here.
// - Do not call AI here.
// - Do not fetch external sources here.
// - Do not inspect user text here.
// - Do not enable runtime features here.

import {
  buildMessageRuntimeContextResolverStatus,
  getCoreRuntimeModuleStatus,
  getMessageRuntimeContextResolverBoundaries,
} from "./index.js";

export const CORE_RUNTIME_DIAGNOSTICS_VERSION = 1;

export function buildCoreRuntimeDiagnostics() {
  const moduleStatus = getCoreRuntimeModuleStatus();
  const resolverStatus = buildMessageRuntimeContextResolverStatus();
  const resolverBoundaries = getMessageRuntimeContextResolverBoundaries();

  const checks = [
    {
      name: "core_runtime_public_boundary_ready",
      ok: moduleStatus.ok === true && moduleStatus.status === "public_boundary_ready",
      details: {
        module: moduleStatus.module,
        status: moduleStatus.status,
      },
    },
    {
      name: "core_runtime_transport_independent",
      ok: moduleStatus.transportIndependent === true && resolverBoundaries.transportIndependent === true,
      details: {
        moduleTransportIndependent: moduleStatus.transportIndependent === true,
        resolverTransportIndependent: resolverBoundaries.transportIndependent === true,
      },
    },
    {
      name: "core_runtime_no_transport_logic",
      ok: moduleStatus.hasTransportLogic === false,
      details: {
        hasTransportLogic: moduleStatus.hasTransportLogic === true,
      },
    },
    {
      name: "core_runtime_no_ai_calls",
      ok: moduleStatus.hasAICalls === false && resolverBoundaries.callsAI === false,
      details: {
        moduleHasAICalls: moduleStatus.hasAICalls === true,
        resolverCallsAI: resolverBoundaries.callsAI === true,
      },
    },
    {
      name: "core_runtime_no_project_memory_writes",
      ok: moduleStatus.hasProjectMemoryWrites === false && resolverBoundaries.writesProjectMemory === false,
      details: {
        moduleHasProjectMemoryWrites: moduleStatus.hasProjectMemoryWrites === true,
        resolverWritesProjectMemory: resolverBoundaries.writesProjectMemory === true,
      },
    },
    {
      name: "core_runtime_no_prompt_injection",
      ok: moduleStatus.hasPromptInjection === false && resolverBoundaries.injectsPromptContext === false,
      details: {
        moduleHasPromptInjection: moduleStatus.hasPromptInjection === true,
        resolverInjectsPromptContext: resolverBoundaries.injectsPromptContext === true,
      },
    },
    {
      name: "core_runtime_no_natural_language_inference",
      ok: moduleStatus.principles?.naturalLanguageInferenceDisabled === true && resolverBoundaries.infersFromNaturalLanguage === false,
      details: {
        naturalLanguageInferenceDisabled: moduleStatus.principles?.naturalLanguageInferenceDisabled === true,
        resolverInfersFromNaturalLanguage: resolverBoundaries.infersFromNaturalLanguage === true,
      },
    },
    {
      name: "core_runtime_access_behavior_before_resolution",
      ok: moduleStatus.principles?.accessAndBehaviorBeforeRuntimeResolution === true,
      details: {
        accessAndBehaviorBeforeRuntimeResolution: moduleStatus.principles?.accessAndBehaviorBeforeRuntimeResolution === true,
      },
    },
  ];

  const failedChecks = checks.filter((check) => !check.ok);

  return {
    ok: failedChecks.length === 0,
    type: "core_runtime_diagnostics",
    version: CORE_RUNTIME_DIAGNOSTICS_VERSION,
    summary: failedChecks.length === 0
      ? "Core runtime diagnostics OK."
      : `Core runtime diagnostics failed: ${failedChecks.length} checks failed.`,
    checks,
    failedChecks,
    moduleStatus,
    resolverStatus,
    resolverBoundaries,
    policy: {
      deterministic: true,
      transportIndependent: true,
      noAICalls: true,
      noProjectMemoryReads: true,
      noProjectMemoryWrites: true,
      noPromptInjection: true,
      noNaturalLanguageInference: true,
      noRuntimeFeatureEnablement: true,
    },
  };
}

export default {
  CORE_RUNTIME_DIAGNOSTICS_VERSION,
  buildCoreRuntimeDiagnostics,
};
