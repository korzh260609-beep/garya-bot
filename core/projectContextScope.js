// core/projectContextScope.js
// ============================================================================
// Project Context Scope Resolver
// Purpose:
// - resolve explicit project memory scope for AI background loading
// - stay transport-agnostic
// - avoid keyword guessing from free-form user text
// - only use explicit structured inputs if they exist
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeOptionalText(value) {
  const s = safeText(value).toLowerCase();
  return s || null;
}

function normalizeScope(input = {}) {
  const source =
    input && typeof input === "object" && !Array.isArray(input) ? input : {};

  const out = {};

  const projectKey = safeText(source.projectKey);
  if (projectKey) out.projectKey = projectKey;

  const projectArea = normalizeOptionalText(source.projectArea);
  if (projectArea) out.projectArea = projectArea;

  const repoScope = normalizeOptionalText(source.repoScope);
  if (repoScope) out.repoScope = repoScope;

  const linkedArea = normalizeOptionalText(source.linkedArea);
  if (linkedArea) out.linkedArea = linkedArea;

  const linkedRepo = normalizeOptionalText(source.linkedRepo);
  if (linkedRepo) out.linkedRepo = linkedRepo;

  if (typeof source.crossRepo === "boolean") {
    out.crossRepo = source.crossRepo;
  }

  return out;
}

function pickCandidateScope(input = {}) {
  const source =
    input && typeof input === "object" && !Array.isArray(input) ? input : {};

  const candidates = [
    source.projectContextScope,
    source.contextScope,
    source.scope,
    source.sourceCtx?.projectContextScope,
    source.runtimeCtx?.projectContextScope,
    source.meta?.projectContextScope,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate;
    }
  }

  return {};
}

export async function resolveProjectContextScope(input = {}) {
  const picked = pickCandidateScope(input);
  return normalizeScope(picked);
}

export default {
  resolveProjectContextScope,
};