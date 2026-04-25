// src/projectExperience/ProjectEvidenceSeedCache.js
// ============================================================================
// Project Evidence Seed Cache (IN-MEMORY / NO DB)
// Purpose:
// - prevent repeated seed building on every trigger
// - introduce cooldown before real GitHub integration
// IMPORTANT:
// - NO DB writes
// - NO external calls
// - process-level memory only
// ============================================================================

const CACHE = new Map();

function now() {
  return Date.now();
}

function makeKey({ projectKey = "garya-bot", repository = "", ref = "main" } = {}) {
  return `${projectKey}:${repository}:${ref}`;
}

export function getCachedSeed(input = {}, { ttlMs = 60_000 } = {}) {
  const key = makeKey(input);
  const entry = CACHE.get(key);
  if (!entry) return null;

  if (now() - entry.ts > ttlMs) {
    CACHE.delete(key);
    return null;
  }

  return entry.value || null;
}

export function setCachedSeed(input = {}, seed = {}) {
  const key = makeKey(input);
  CACHE.set(key, { value: seed, ts: now() });
  return seed;
}

export function clearSeedCache() {
  CACHE.clear();
}

export default {
  getCachedSeed,
  setCachedSeed,
  clearSeedCache,
};
