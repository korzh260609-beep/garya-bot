// core/projectContext.js
// ============================================================================
// Safe helper for loading project background context from project memory.
// IMPORTANT:
// - project memory is soft background, not proof of runtime implementation
// - repo/runtime checks remain source of truth for current implementation state
// ============================================================================

import { buildProjectMemoryContext } from "../projectMemory.js";

export async function loadProjectContext() {
  try {
    const text = await buildProjectMemoryContext();
    return String(text || "").slice(0, 4000);
  } catch (err) {
    console.error("❌ loadProjectContext error:", err);
    return "";
  }
}

export default {
  loadProjectContext,
};