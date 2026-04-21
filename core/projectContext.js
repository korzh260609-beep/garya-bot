// core/projectContext.js
// ============================================================================
// Safe helper for loading project background context from project memory.
// IMPORTANT:
// - project memory is confirmed background, not proof of runtime implementation
// - repo/runtime checks remain source of truth for current implementation state
// - current stage / workflow / roadmap must not be inferred from project memory
// ============================================================================

import { buildConfirmedProjectMemoryContext } from "../projectMemory.js";

export async function loadProjectContext() {
  try {
    const text = await buildConfirmedProjectMemoryContext();
    return String(text || "").slice(0, 4000);
  } catch (err) {
    console.error("❌ loadProjectContext error:", err);
    return "";
  }
}

export default {
  loadProjectContext,
};
