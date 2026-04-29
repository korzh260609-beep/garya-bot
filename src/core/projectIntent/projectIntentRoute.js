// src/core/projectIntent/projectIntentRoute.js
// ============================================================================
// LEGACY TECHNICAL MODE ROUTE FACADE MARKER
//
// INTERFACE MODE NOTE:
// - This public compatibility facade now points explicitly to Technical Mode.
// - The actual legacy route resolver is exposed via
//   ./modes/technical/projectIntentTechnicalRoute.js.
// - Public exports are kept compatible.
// - Runtime route logic is unchanged; this file only re-exports the same legacy
//   route logic through the Technical Mode boundary.
// - This is NOT full Human Mode and NOT a global SemanticRouter.
// ============================================================================

export * from "./modes/technical/projectIntentTechnicalRoute.js";
export { default } from "./modes/technical/projectIntentTechnicalRoute.js";
