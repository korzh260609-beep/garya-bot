// src/bot/router/sourceDomainCommands.js
//
// LEGACY SHIM
// ----------------------------------------------------------------------------
// Source-domain commands were moved to the main command path:
//
//   CMD_ACTION -> requirePermOrReply -> dispatchCommand -> sources handlers
//
// Current source of truth:
// - src/bot/cmdActionMap.js
// - src/bot/commandDispatcher.js
// - src/bot/dispatchers/dispatchSourcesCommands.js
//
// Why this file still exists:
// - messageRouter still calls handleSourceDomainCommands(...) as a late fallback
// - keeping this shim is safer than deleting the call site immediately
//
// Rule:
// - do NOT execute source handlers from here anymore
// - return false and let the main dispatcher path remain the only active path
// ----------------------------------------------------------------------------

export async function handleSourceDomainCommands() {
  return false;
}

export default {
  handleSourceDomainCommands,
};