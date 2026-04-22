// src/projectMemory/projectMemoryConfirmedScopePolicy.js
// ============================================================================
// Project Memory Confirmed Scope Policy
// Purpose:
// - define universal semantic rules for confirmed-memory scope handling
// - keep policy separate from transport, reader, and writer logic
// - fix "what should be scoped?" before tightening write-path
// - preserve backward compatibility for legacy unscoped confirmed rows
// - avoid fake repo assumptions about specific global section names
// ============================================================================

import {
  PROJECT_MEMORY_AREAS,
  PROJECT_MEMORY_REPO_SCOPES,
  readCrossRepoFromMeta,
  readLinkedAreasFromMeta,
  readLinkedRepoScopesFromMeta,
  readProjectAreaFromMeta,
  readRepoScopeFromMeta,
} from "./projectMemoryScopes.js";

function safeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isNonEmpty(value) {
  return !!safeText(value);
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeEntryType(value) {
  return safeText(value);
}

function normalizeSection(value) {
  return safeText(value);
}

export const CONFIRMED_SCOPE_POLICY_VERSION = 2;

export const CONFIRMED_ENTRY_TYPES = Object.freeze({
  SECTION_STATE: "section_state",
  DECISION: "decision",
  CONSTRAINT: "constraint",
  NEXT_STEP: "next_step",
});

export const CONFIRMED_SCOPE_CLASSES = Object.freeze({
  LEGACY_UNSCOPED: "legacy_unscoped",
  GLOBAL_UNSCOPED_CANDIDATE: "global_unscoped_candidate",
  SCOPED_LOCAL: "scoped_local",
  SCOPED_SHARED: "scoped_shared",
  INVALID: "invalid",
});

export const CONFIRMED_SCOPE_REQUIREMENTS = Object.freeze({
  ALLOW_UNSCOPED: "allow_unscoped",
  REQUIRE_EXPLICIT_SCOPE: "require_explicit_scope",
});

export const EXPLICIT_SCOPE_REQUIRED_ENTRY_TYPES = Object.freeze(
  new Set([
    CONFIRMED_ENTRY_TYPES.DECISION,
    CONFIRMED_ENTRY_TYPES.CONSTRAINT,
    CONFIRMED_ENTRY_TYPES.NEXT_STEP,
  ])
);

export const UNSCOPED_ALLOWED_ENTRY_TYPES = Object.freeze(
  new Set([
    CONFIRMED_ENTRY_TYPES.SECTION_STATE,
  ])
);

export function readScopeSignature(meta = {}) {
  return {
    projectArea: readProjectAreaFromMeta(meta),
    repoScope: readRepoScopeFromMeta(meta),
    linkedAreas: readLinkedAreasFromMeta(meta),
    linkedRepoScopes: readLinkedRepoScopesFromMeta(meta),
    crossRepo: readCrossRepoFromMeta(meta),
  };
}

export function hasAnyExplicitScope(meta = {}) {
  const scope = readScopeSignature(meta);

  return (
    isNonEmpty(scope.projectArea) ||
    isNonEmpty(scope.repoScope) ||
    ensureArray(scope.linkedAreas).length > 0 ||
    ensureArray(scope.linkedRepoScopes).length > 0 ||
    scope.crossRepo === true
  );
}

export function isSharedSharedCrossRepo(meta = {}) {
  const scope = readScopeSignature(meta);

  return (
    scope.projectArea === PROJECT_MEMORY_AREAS.SHARED &&
    scope.repoScope === PROJECT_MEMORY_REPO_SCOPES.SHARED &&
    scope.crossRepo === true
  );
}

export function isScopedLocal(meta = {}) {
  const scope = readScopeSignature(meta);

  return (
    (isNonEmpty(scope.projectArea) || isNonEmpty(scope.repoScope)) &&
    scope.crossRepo !== true
  );
}

export function isGlobalUnscopedCandidate({ entryType, meta = {} } = {}) {
  const normalizedEntryType = normalizeEntryType(entryType);

  if (normalizedEntryType !== CONFIRMED_ENTRY_TYPES.SECTION_STATE) {
    return false;
  }

  return !hasAnyExplicitScope(meta);
}

export function classifyConfirmedScope({ entryType, section = null, meta = {} } = {}) {
  const normalizedEntryType = normalizeEntryType(entryType);
  const normalizedSection = normalizeSection(section);
  const scope = readScopeSignature(meta);

  void normalizedSection;

  if (!normalizedEntryType) {
    return {
      scopeClass: CONFIRMED_SCOPE_CLASSES.INVALID,
      reason: "entry_type_missing",
      scope,
    };
  }

  if (!hasAnyExplicitScope(meta)) {
    if (isGlobalUnscopedCandidate({ entryType: normalizedEntryType, meta })) {
      return {
        scopeClass: CONFIRMED_SCOPE_CLASSES.GLOBAL_UNSCOPED_CANDIDATE,
        reason: "unscoped_section_state_without_repo_verified_global_name",
        scope,
      };
    }

    return {
      scopeClass: CONFIRMED_SCOPE_CLASSES.LEGACY_UNSCOPED,
      reason: "no_explicit_scope",
      scope,
    };
  }

  if (isSharedSharedCrossRepo(meta)) {
    return {
      scopeClass: CONFIRMED_SCOPE_CLASSES.SCOPED_SHARED,
      reason: "shared_shared_cross_repo",
      scope,
    };
  }

  if (isScopedLocal(meta)) {
    return {
      scopeClass: CONFIRMED_SCOPE_CLASSES.SCOPED_LOCAL,
      reason: "explicit_local_scope",
      scope,
    };
  }

  return {
    scopeClass: CONFIRMED_SCOPE_CLASSES.INVALID,
    reason: "explicit_scope_shape_not_recognized",
    scope,
  };
}

export function getConfirmedScopeRequirement({ entryType, section = null } = {}) {
  const normalizedEntryType = normalizeEntryType(entryType);
  const normalizedSection = normalizeSection(section);

  void normalizedSection;

  if (EXPLICIT_SCOPE_REQUIRED_ENTRY_TYPES.has(normalizedEntryType)) {
    return {
      requirement: CONFIRMED_SCOPE_REQUIREMENTS.REQUIRE_EXPLICIT_SCOPE,
      reason: "semantic_entry_requires_explicit_scope",
    };
  }

  if (UNSCOPED_ALLOWED_ENTRY_TYPES.has(normalizedEntryType)) {
    return {
      requirement: CONFIRMED_SCOPE_REQUIREMENTS.ALLOW_UNSCOPED,
      reason: "section_state_unscoped_allowed_for_legacy_or_global_candidate",
    };
  }

  return {
    requirement: CONFIRMED_SCOPE_REQUIREMENTS.REQUIRE_EXPLICIT_SCOPE,
    reason: "unknown_confirmed_type_should_not_write_unscoped",
  };
}

export function shouldAllowLegacyUnscopedRead({ entryType, section = null, meta = {} } = {}) {
  const classification = classifyConfirmedScope({ entryType, section, meta });

  return (
    classification.scopeClass === CONFIRMED_SCOPE_CLASSES.LEGACY_UNSCOPED ||
    classification.scopeClass === CONFIRMED_SCOPE_CLASSES.GLOBAL_UNSCOPED_CANDIDATE
  );
}

export function shouldIncludeInScopedContext({ entryType, section = null, meta = {} } = {}) {
  const classification = classifyConfirmedScope({ entryType, section, meta });

  return (
    classification.scopeClass === CONFIRMED_SCOPE_CLASSES.SCOPED_LOCAL ||
    classification.scopeClass === CONFIRMED_SCOPE_CLASSES.SCOPED_SHARED
  );
}

export function shouldMigrateLegacyUnscopedLater({ entryType, section = null, meta = {} } = {}) {
  const classification = classifyConfirmedScope({ entryType, section, meta });

  return (
    classification.scopeClass === CONFIRMED_SCOPE_CLASSES.LEGACY_UNSCOPED ||
    classification.scopeClass === CONFIRMED_SCOPE_CLASSES.GLOBAL_UNSCOPED_CANDIDATE
  );
}

export function validateConfirmedScopeForWrite({ entryType, section = null, meta = {} } = {}) {
  const requirement = getConfirmedScopeRequirement({ entryType, section });
  const classification = classifyConfirmedScope({ entryType, section, meta });

  if (requirement.requirement === CONFIRMED_SCOPE_REQUIREMENTS.ALLOW_UNSCOPED) {
    return {
      ok:
        classification.scopeClass === CONFIRMED_SCOPE_CLASSES.GLOBAL_UNSCOPED_CANDIDATE ||
        classification.scopeClass === CONFIRMED_SCOPE_CLASSES.SCOPED_LOCAL ||
        classification.scopeClass === CONFIRMED_SCOPE_CLASSES.SCOPED_SHARED,
      requirement,
      classification,
    };
  }

  return {
    ok:
      classification.scopeClass === CONFIRMED_SCOPE_CLASSES.SCOPED_LOCAL ||
      classification.scopeClass === CONFIRMED_SCOPE_CLASSES.SCOPED_SHARED,
    requirement,
    classification,
  };
}

export function buildConfirmedScopePolicySnapshot({ entryType, section = null, meta = {} } = {}) {
  const requirement = getConfirmedScopeRequirement({ entryType, section });
  const classification = classifyConfirmedScope({ entryType, section, meta });

  return {
    policyVersion: CONFIRMED_SCOPE_POLICY_VERSION,
    entryType: normalizeEntryType(entryType) || null,
    section: normalizeSection(section) || null,
    requirement,
    classification,
    shouldAllowLegacyUnscopedRead: shouldAllowLegacyUnscopedRead({
      entryType,
      section,
      meta,
    }),
    shouldIncludeInScopedContext: shouldIncludeInScopedContext({
      entryType,
      section,
      meta,
    }),
    shouldMigrateLegacyUnscopedLater: shouldMigrateLegacyUnscopedLater({
      entryType,
      section,
      meta,
    }),
  };
}

export default {
  CONFIRMED_SCOPE_POLICY_VERSION,
  CONFIRMED_ENTRY_TYPES,
  CONFIRMED_SCOPE_CLASSES,
  CONFIRMED_SCOPE_REQUIREMENTS,
  EXPLICIT_SCOPE_REQUIRED_ENTRY_TYPES,
  UNSCOPED_ALLOWED_ENTRY_TYPES,
  readScopeSignature,
  hasAnyExplicitScope,
  isSharedSharedCrossRepo,
  isScopedLocal,
  isGlobalUnscopedCandidate,
  classifyConfirmedScope,
  getConfirmedScopeRequirement,
  shouldAllowLegacyUnscopedRead,
  shouldIncludeInScopedContext,
  shouldMigrateLegacyUnscopedLater,
  validateConfirmedScopeForWrite,
  buildConfirmedScopePolicySnapshot,
};