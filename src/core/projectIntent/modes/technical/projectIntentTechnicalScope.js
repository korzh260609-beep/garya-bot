// src/core/projectIntent/modes/technical/projectIntentTechnicalScope.js
// ============================================================================
// TECHNICAL MODE PROJECT INTENT SCOPE
//
// INTERFACE MODE NOTE:
// - This module is the explicit Technical Mode facade for the legacy
//   projectIntent scope classifier.
// - It may use deterministic phrase/token/prefix/path signals because it belongs
//   to Technical Mode.
// - Do not use this as Human Mode intelligence.
// - Do not add new phrase-bound Human Mode behavior here.
// ============================================================================

export * from "../../scope/projectIntentScopeConstants.js";
export {
  collectProjectIntentSignals,
  resolveProjectIntentMatch,
} from "../../scope/projectIntentScopeClassifier.js";

export { default } from "../../scope/projectIntentScopeClassifier.js";
