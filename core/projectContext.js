// core/projectContext.js
// ============================================================================
// Safe helper for loading project background context from project memory.
// IMPORTANT:
// - project memory is confirmed background, not proof of runtime implementation
// - repo/runtime checks remain source of truth for current implementation state
// - current stage / workflow / roadmap must not be inferred from project memory
// - this loader is transport-agnostic and accepts optional explicit scope
// ============================================================================

import { buildConfirmedProjectMemoryContext } from "../projectMemory.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeScope(input = {}) {
  const source =
    input && typeof input === "object" && !Array.isArray(input) ? input : {};

  const out = {};

  const projectKey = safeText(source.projectKey);
  if (projectKey) out.projectKey = projectKey;

  const projectArea = safeText(source.projectArea).toLowerCase();
  if (projectArea) out.projectArea = projectArea;

  const repoScope = safeText(source.repoScope).toLowerCase();
  if (repoScope) out.repoScope = repoScope;

  const linkedArea = safeText(source.linkedArea).toLowerCase();
  if (linkedArea) out.linkedArea = linkedArea;

  const linkedRepo = safeText(source.linkedRepo).toLowerCase();
  if (linkedRepo) out.linkedRepo = linkedRepo;

  if (typeof source.crossRepo === "boolean") {
    out.crossRepo = source.crossRepo;
  }

  return out;
}

export async function loadProjectContext(scope = {}) {
  try {
    const normalizedScope = normalizeScope(scope);
    const text = await buildConfirmedProjectMemoryContext(normalizedScope);
    return String(text || "").slice(0, 4000);
  } catch (err) {
    console.error("❌ loadProjectContext error:", err);
    return "";
  }
}

export default {
  loadProjectContext,
};