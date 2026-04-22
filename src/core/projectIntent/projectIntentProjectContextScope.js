// src/core/projectIntent/projectIntentProjectContextScope.js
// ============================================================================
// Project Intent -> Project Context Scope bridge
// Purpose:
// - convert structured repo conversation context into explicit projectContextScope
// - delegate actual scope mapping to universal policy layer
// - use ONLY structured repo target metadata
// - do NOT read user free-form text
// - do NOT add Telegram-only logic
// ============================================================================

import { resolveProjectContextScopeByRepoObject } from "../../../core/projectContextScopePolicy.js";

export function buildProjectContextScopeFromRepoContext(input = {}) {
  return resolveProjectContextScopeByRepoObject(input);
}

export default {
  buildProjectContextScopeFromRepoContext,
};