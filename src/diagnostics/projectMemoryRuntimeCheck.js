// src/diagnostics/projectMemoryRuntimeCheck.js
// SG 2.0 — Project Memory runtime diagnostics check.
// Purpose: report Project Memory runtime boundaries and feature flags without writes or transport coupling.
// Do not add Telegram logic, AI calls, memory writes, candidate confirmation, source sync, or raw secret output here.

import { isDatabaseConfigured } from "../db/postgresClient.js";
import {
  ProjectMemoryConfirmation,
  ProjectMemoryRuntimeContext,
  getMemoryModuleStatus,
} from "../memory/index.js";
import { getMessageProjectMemoryContextGateOptionsFromEnv } from "../core/message/messageProjectMemoryContextGate.js";
import { getProjectMemorySchemaBootstrapOptionsFromEnv } from "../app/projectMemoryBootstrap.js";

export const PROJECT_MEMORY_RUNTIME_CHECK_VERSION = 1;

function safeBoolean(value) {
  return Boolean(value);
}

function buildSafetySummary({ memoryStatus, confirmationStatus, runtimeContextStatus, gateOptions, schemaBootstrapOptions, databaseConfigured }) {
  return {
    databaseConfigured: safeBoolean(databaseConfigured),
    storageBoundaryAvailable: safeBoolean(memoryStatus?.hasStorageBoundary),
    confirmationBoundaryAvailable: safeBoolean(memoryStatus?.hasDurableProjectMemoryConfirmationBoundary),
    runtimeReadBridgeAvailable: safeBoolean(memoryStatus?.hasProjectMemoryRuntimeReadBridge),
    schemaBootstrapEnabled: safeBoolean(schemaBootstrapOptions?.enabled),
    schemaBootstrapFailStartup: safeBoolean(schemaBootstrapOptions?.failStartupOnError),
    projectMemoryReadEnabled: safeBoolean(gateOptions?.enabled),
    promptInjectionEnabled: safeBoolean(gateOptions?.injectIntoPrompt),
    confirmationAutoWriteDisabled: confirmationStatus?.autoWriteFromChat === false && confirmationStatus?.autoWriteFromAI === false,
    runtimeContextWritesStorage: safeBoolean(runtimeContextStatus?.writesStorage),
    runtimeContextCallsAI: safeBoolean(runtimeContextStatus?.callsAI),
    runtimeContextTouchesTelegram: safeBoolean(runtimeContextStatus?.telegramConnected),
    runtimeContextInjectsPrompt: safeBoolean(runtimeContextStatus?.injectsPrompt),
  };
}

function buildWarnings(summary = {}) {
  const warnings = [];

  if (summary.promptInjectionEnabled && !summary.projectMemoryReadEnabled) {
    warnings.push({
      code: "project_memory_prompt_injection_without_read",
      message: "Project Memory prompt injection flag is enabled while read flag is disabled.",
    });
  }

  if (summary.schemaBootstrapEnabled && !summary.databaseConfigured) {
    warnings.push({
      code: "project_memory_schema_bootstrap_without_database",
      message: "Project Memory schema bootstrap is enabled but DATABASE_URL is not configured.",
    });
  }

  if (summary.runtimeContextWritesStorage) {
    warnings.push({
      code: "project_memory_runtime_context_writes_storage",
      message: "Project Memory runtime context reports storage writes enabled, which is unsafe for read diagnostics.",
    });
  }

  if (summary.runtimeContextCallsAI) {
    warnings.push({
      code: "project_memory_runtime_context_calls_ai",
      message: "Project Memory runtime context reports AI calls enabled, which is outside the runtime read boundary.",
    });
  }

  if (summary.runtimeContextTouchesTelegram) {
    warnings.push({
      code: "project_memory_runtime_context_touches_telegram",
      message: "Project Memory runtime context reports Telegram coupling, which violates transport independence.",
    });
  }

  if (summary.runtimeContextInjectsPrompt) {
    warnings.push({
      code: "project_memory_runtime_context_injects_prompt",
      message: "Project Memory runtime context reports prompt injection, which must stay in messageContextInjection gate.",
    });
  }

  return warnings;
}

export function runProjectMemoryRuntimeCheck() {
  const memoryStatus = getMemoryModuleStatus();
  const confirmation = new ProjectMemoryConfirmation();
  const runtimeContext = new ProjectMemoryRuntimeContext();
  const confirmationStatus = confirmation.status();
  const runtimeContextStatus = runtimeContext.status();
  const gateOptions = getMessageProjectMemoryContextGateOptionsFromEnv();
  const schemaBootstrapOptions = getProjectMemorySchemaBootstrapOptionsFromEnv();
  const databaseConfigured = isDatabaseConfigured();

  const summary = buildSafetySummary({
    memoryStatus,
    confirmationStatus,
    runtimeContextStatus,
    gateOptions,
    schemaBootstrapOptions,
    databaseConfigured,
  });
  const warnings = buildWarnings(summary);

  const ok = warnings.length === 0
    && summary.storageBoundaryAvailable
    && summary.confirmationBoundaryAvailable
    && summary.runtimeReadBridgeAvailable
    && summary.confirmationAutoWriteDisabled
    && !summary.runtimeContextWritesStorage
    && !summary.runtimeContextCallsAI
    && !summary.runtimeContextTouchesTelegram
    && !summary.runtimeContextInjectsPrompt;

  return {
    ok,
    type: "project_memory_runtime_check",
    version: PROJECT_MEMORY_RUNTIME_CHECK_VERSION,
    summary: ok
      ? "Project Memory runtime boundaries OK."
      : "Project Memory runtime boundaries need attention.",
    details: summary,
    warnings,
    sanitized: true,
  };
}

export default {
  runProjectMemoryRuntimeCheck,
};
