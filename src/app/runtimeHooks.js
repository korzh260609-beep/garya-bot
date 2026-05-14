// AGENT NOTE:
// SG 2.0 runtime hooks boundary.
// Purpose: start optional runtime hooks without bloating index.js or app factory.
// Do not add routes, Telegram handlers, AI calls, DB calls, or GitHub writes here.

import { startMigrationRuntimeHook } from "./migrationRuntimeHook.js";

export function startRuntimeHooks() {
  const migrationRuntimeHook = startMigrationRuntimeHook();

  return {
    ok: true,
    hooks: {
      migrationRuntimeHook,
    },
    stop() {
      const migrationStop = typeof migrationRuntimeHook?.stop === "function"
        ? migrationRuntimeHook.stop()
        : { ok: true, stopped: false, reason: "migration_runtime_hook_missing_stop" };

      return {
        ok: true,
        stopped: false,
        reason: "runtime_hooks_no_active_hooks",
        hooks: {
          migrationRuntimeHook: migrationStop,
        },
      };
    },
  };
}

export default {
  startRuntimeHooks,
};
