// src/bot/router/repoDomainCommands.js
//
// LEGACY SHIM
// ----------------------------------------------------------------------------
// Repo-domain commands were moved to the main command path:
//
//   CMD_ACTION -> requirePermOrReply -> dispatchCommand -> repo handlers
//
// Current source of truth:
// - src/bot/cmdActionMap.js
// - src/bot/commandDispatcher.js
//
// Why this file still exists:
// - messageRouter still calls handleRepoDomainCommands(...) as a late fallback
// - keeping this shim is safer than deleting the call site immediately
//
// Rule:
// - do NOT execute repo handlers from here anymore
// - return false and let the main dispatcher path remain the only active path
// ----------------------------------------------------------------------------

export async function handleRepoDomainCommands() {
  return false;
}

export default {
  handleRepoDomainCommands,
};