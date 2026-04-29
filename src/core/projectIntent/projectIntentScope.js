// src/core/projectIntent/projectIntentScope.js
// ============================================================================
// LEGACY PROJECT INTENT SCOPE FACADE MARKER
//
// INTERFACE MODE NOTE:
// - The actual legacy scope classifier has been split into ./scope/* modules.
// - Public exports are kept compatible.
// - Runtime intent logic is unchanged; this file only re-exports the split logic.
// - Under hard Human Mode / Technical Mode separation, this remains legacy
//   Technical Mode support, not full Human Mode.
// ============================================================================

import * as scopeConstants from "./scope/projectIntentScopeConstants.js";
import {
  collectProjectIntentSignals,
  resolveProjectIntentMatch,
} from "./scope/projectIntentScopeClassifier.js";

export * from "./scope/projectIntentScopeConstants.js";
export {
  collectProjectIntentSignals,
  resolveProjectIntentMatch,
};

export default {
  ...scopeConstants,
  collectProjectIntentSignals,
  resolveProjectIntentMatch,
};
