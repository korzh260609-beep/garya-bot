// src/core/projectIntent/projectIntentReadPlan.js
// ============================================================================
// LEGACY TECHNICAL MODE READ-PLAN FACADE MARKER
//
// INTERFACE MODE NOTE:
// - This public compatibility facade now points explicitly to Technical Mode.
// - The actual legacy read-plan resolver is exposed via
//   ./modes/technical/projectIntentTechnicalReadPlan.js.
// - Public exports are kept compatible.
// - Runtime read-plan logic is unchanged; this file only re-exports the same
//   legacy logic through the Technical Mode boundary.
// - This is NOT full Human Mode and NOT a global SemanticRouter.
// ============================================================================

export * from "./modes/technical/projectIntentTechnicalReadPlan.js";
export { default } from "./modes/technical/projectIntentTechnicalReadPlan.js";
