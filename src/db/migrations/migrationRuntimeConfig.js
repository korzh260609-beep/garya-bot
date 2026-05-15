// AGENT NOTE:
// SG 2.0 migration runtime config boundary.
// Purpose: read migration boot env flags without executing migrations.
// Do not add DB queries, Telegram logic, AI calls, Project Memory writes, or hidden execution here.

import { envBool, envStr } from "../../config/envPrimitives.js";

export const MIGRATION_RUNTIME_ENV = Object.freeze({
  RUN_MIGRATIONS_ON_BOOT: "RUN_MIGRATIONS_ON_BOOT",
  APPROVE_MIGRATIONS_ON_BOOT: "APPROVE_MIGRATIONS_ON_BOOT",
});

export function getMigrationRuntimeConfigFromEnv() {
  const runKey = MIGRATION_RUNTIME_ENV.RUN_MIGRATIONS_ON_BOOT;
  const approvalKey = MIGRATION_RUNTIME_ENV.APPROVE_MIGRATIONS_ON_BOOT;
  const runMigrationsOnBoot = envBool(runKey, false);
  const approvedOnBoot = envBool(approvalKey, false);

  return {
    ok: true,
    type: "migration_runtime_config",
    source: "env",
    env: {
      runMigrationsOnBoot: {
        key: runKey,
        configured: Boolean(envStr(runKey, "").trim()),
        enabled: runMigrationsOnBoot,
      },
      approveMigrationsOnBoot: {
        key: approvalKey,
        configured: Boolean(envStr(approvalKey, "").trim()),
        enabled: approvedOnBoot,
      },
    },
    gates: {
      automaticExecutionRequested: runMigrationsOnBoot,
      automaticExecutionApproved: approvedOnBoot,
      automaticExecutionAllowed: runMigrationsOnBoot && approvedOnBoot,
    },
    rules: {
      usesExistingRunEnvVariable: true,
      usesSeparateApprovalEnvVariable: true,
      envDoesNotExecuteByItself: true,
      bothEnvGatesRequired: true,
      noDbMutation: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
    },
  };
}

export default {
  MIGRATION_RUNTIME_ENV,
  getMigrationRuntimeConfigFromEnv,
};
