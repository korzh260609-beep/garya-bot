// src/core/projectIntent/projectIntentScope.js
// ============================================================================
// LEGACY TECHNICAL MODE SCOPE FACADE MARKER
//
// INTERFACE MODE NOTE:
// - This public compatibility facade now points explicitly to Technical Mode.
// - The actual legacy scope classifier lives under ./scope/* and is exposed via
//   ./modes/technical/projectIntentTechnicalScope.js.
// - Public exports are kept compatible.
// - Runtime intent logic is unchanged; this file only re-exports the same split
//   legacy logic through the Technical Mode boundary.
// - This is NOT full Human Mode.
// ============================================================================

import * as technicalScope from "./modes/technical/projectIntentTechnicalScope.js";
import {
  collectProjectIntentSignals,
  resolveProjectIntentMatch,
} from "./modes/technical/projectIntentTechnicalScope.js";

export * from "./modes/technical/projectIntentTechnicalScope.js";
export {
  collectProjectIntentSignals,
  resolveProjectIntentMatch,
};

export default {
  ...technicalScope,
  collectProjectIntentSignals,
  resolveProjectIntentMatch,
};
