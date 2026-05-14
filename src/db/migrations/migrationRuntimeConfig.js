// AGENT NOTE:
// SG 2.0 migration runtime config boundary.
// Purpose: read the existing migration boot env flag without executing migrations.
// Do not add DB queries, startup hooks, Telegram logic, AI calls, Project Memory writes, or hidden execution here.

import { envBool, envStr } from "../../config/envPrimitives.js";

export const MIGRATION_RUNTIME_ENV = Object.freeze({
  RUN_MIGRATIONS_ON_BOOT: "RUN_MIGRATIONS_ON_BOOT",
});

export function getMigrationRuntimeConfigFromEnv() {
  const key = MIGRATION_RUNTIME_ENV.RUN_MIGRATIONS_ON_BOOT;

  return {
    ok: true,
    type: "migration_runtime_config",
    source: "env",
    env: {
      runMigrationsOnBoot: {
        key,
        configured: Boolean(envStr(key, "").trim()),
        enabled: envBool(key, false),
      },
    },
    rules: {
      usesExistingEnvVariable: true,
      envDoesNotExecuteByItself: true,
      noDbMutation: true,
      noStartupHook: true,
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
