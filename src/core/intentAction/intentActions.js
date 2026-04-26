// src/core/intentAction/intentActions.js
// ============================================================================
// STAGE 7A — Intent action config skeleton
// Purpose:
// - define structured intent-to-action metadata for the future IntentActionRouter
// - keep runtime behavior unchanged
// - keep SG user interaction natural-language driven
// - do NOT parse raw user text here
// - do NOT add keyword or phrase dictionaries here
// - do NOT execute handlers here
// - do NOT connect to dispatcher/runtime here
//
// Boundary:
// - upstream meaning/AI layer must produce structured intent keys
// - this config only maps structured intent keys to internal action metadata
// - slash commands remain internal/admin/diagnostic controls
// ============================================================================

import {
  INTENT_ACTION_SCOPES,
  INTENT_ACTION_STATUS,
} from "./IntentActionRouter.js";

function shadowAction({
  actionKey,
  intentKeys = [],
  handlerKey = null,
  commandKey = null,
  scope = INTENT_ACTION_SCOPES.GENERAL,
  monarchOnly = false,
  privateOnly = false,
  requiresTrustedPath = false,
  metadata = {},
} = {}) {
  return {
    actionKey,
    intentKeys,
    handlerKey,
    commandKey,
    scope,
    status: INTENT_ACTION_STATUS.SHADOW,
    monarchOnly,
    privateOnly,
    requiresTrustedPath,
    metadata,
  };
}

export const INTENT_ACTIONS = Object.freeze([
  // Intentionally empty for now.
  // Add actions only after the structured meaning/intent layer is defined.
  // Example shape for future use:
  // shadowAction({
  //   actionKey: "project.repo.status",
  //   intentKeys: ["project_repo_status"],
  //   handlerKey: "projectRepo.status",
  //   commandKey: "/repo_status",
  //   scope: INTENT_ACTION_SCOPES.PROJECT_REPO,
  //   monarchOnly: true,
  //   privateOnly: true,
  //   requiresTrustedPath: true,
  // }),
]);

export const INTENT_ACTION_CONFIG_STATUS = Object.freeze({
  ok: true,
  status: INTENT_ACTION_STATUS.SHADOW,
  actionCount: INTENT_ACTIONS.length,
  runtimeConnected: false,
  rawTextParsing: false,
  phraseMatching: false,
});

export { shadowAction };

export default INTENT_ACTIONS;
