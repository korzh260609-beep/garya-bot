// AGENT NOTE:
// SG 2.0 runtime hooks boundary.
// Purpose: start optional runtime hooks without bloating index.js or app factory.
// Do not add routes, Telegram handlers, AI calls, DB calls, or GitHub writes here.

export function startRuntimeHooks() {
  return {
    ok: true,
    stop() {
      return {
        ok: true,
        stopped: false,
        reason: "runtime_hooks_no_active_hooks",
      };
    },
  };
}

export default {
  startRuntimeHooks,
};
