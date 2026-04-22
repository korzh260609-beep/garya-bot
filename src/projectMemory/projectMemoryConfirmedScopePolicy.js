// src/projectMemory/projectMemoryConfirmedScopePolicy.js
// ============================================================================
// Project Memory Confirmed Scope Policy
// Purpose:
// - define universal semantic rules for confirmed-memory scope handling
// - keep policy separate from transport, reader, and writer logic
// - fix "what should be scoped?" before tightening write-path
// - preserve backward compatibility for legacy unscoped confirmed rows
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

export const CONFIRMED_SCOPE_POLICY_VERSION = 1;

export const CONFIRMED_ENTRY_TYPES = Object.freeze({
  SECTION_STATE: "section_state",
  DECISION: "decision",
  CONSTRAINT: "constraint",
  NEXT_STEP: "next_step",
});

export const CONFIRMED_SCOPE_CLASSES = Object.freeze({
  LEGACY_UNSCOPED: "legacy_unscoped",
  GLOBAL_UNSCOPED: "global_unscoped",
  SCOPED_LOCAL: "scoped_local",
  SCOPED_SHARED: "scoped_shared",
  INVALID: "invalid",
});

export const CONFIRMED_SCOPE_REQUIREMENTS = Object.freeze({
  ALLOW_UNSCOPED: "allow_unscoped",
  REQUIRE_EXPLICIT_SCOPE: "require_explicit_scope",
});

export const GLOBAL_UNSCOPED_SECTION_STATES = Object.freeze(
  new Set([
    "canonical_project_summary",
    "project_summary",
    "canonical_summary",
    "global_summary",
  ])
);

export const EXPLICIT_SCOPE_REQUIRED_ENTRY_TYPES = Object.freeze(
  new Set([
    CONFIRMED_ENTRY_TYPES.DECISION,
    CONFIRMED_ENTRY_TYPES.CONSTRAINT,
    CONFIRMED_ENTRY_TYPES.NEXT_STEP,
  ])
);

export const UNscoped_ALLOWED_ENTRY_TYPES = Object.freeze(
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
    (
      isNonEmpty(scope.projectArea) ||
      isNonEmpty(scope.repoScope)
    ) &&
    scope.crossRepo !== true
  );
}

export function classifyConfirmedScope({ entryType, section = null, meta = {} } = {}) {
  const normalizedEntryType = normalizeEntryType(entryType);
  const normalizedSection = normalizeSection(section);
  const scope = readScopeSignature(meta);
  const hasExplicit = hasAnyExplicitScope(meta);

  if (!normalizedEntryType) {
    return {
      scopeClass: CONFIRMED_SCOPE_CLASSES.INVALID,
      reason: "entry_type_missing",
      scope,
    };
  }

  if (!hasExplicit) {
    if (
      normalizedEntryType === CONFIRMED_ENTRY_TYPES.SECTION_STATE &&
      GLOBAL_UNSCOPED_SECTION_STATES.has(normalizedSection)
    ) {
      return {
        scopeClass: CONFIRMED_SCOPE_CLASSES.GLOBAL_UNSCOPED,
        reason: "global_unscoped_section_state",
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

  if (EXPLICIT_SCOPE_REQUIRED_ENTRY_TYPES.has(normalizedEntryType)) {
    return {
      requirement: CONFIRMED_SCOPE_REQUIREMENTS.REQUIRE_EXPLICIT_SCOPE,
      reason: "semantic_entry_requires_explicit_scope",
    };
  }

  if (normalizedEntryType === CONFIRMED_ENTRY_TYPES.SECTION_STATE) {
    if (GLOBAL_UNSCOPED_SECTION_STATES.has(normalizedSection)) {
      return {
        requirement: CONFIRMED_SCOPE_REQUIREMENTS.ALLOW_UNSCOPED,
        reason: "global_section_state_may_remain_unscoped",
      };
    }

    return {
      requirement: CONFIRMED_SCOPE_REQUIREMENTS.REQUIRE_EXPLICIT_SCOPE,
      reason: "section_state_defaults_to_explicit_scope_unless_global",
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
    classification.scopeClass === CONFIRMED_SCOPE_CLASSES.GLOBAL_UNSCOPED
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

  if (classification.scopeClass !== CONFIRMED_SCOPE_CLASSES.LEGACY_UNSCOPED) {
    return false;
  }

  const normalizedEntryType = normalizeEntryType(entryType);
  const normalizedSection = normalizeSection(section);

  if (
    normalizedEntryType === CONFIRMED_ENTRY_TYPES.SECTION_STATE &&
    GLOBAL_UNSCOPED_SECTION_STATES.has(normalizedSection)
  ) {
    return false;
  }

  return true;
}

export function validateConfirmedScopeForWrite({ entryType, section = null, meta = {} } = {}) {
  const requirement = getConfirmedScopeRequirement({ entryType, section });
  const classification = classifyConfirmedScope({ entryType, section, meta });

  if (
    requirement.requirement === CONFIRMED_SCOPE_REQUIREMENTS.ALLOW_UNSCOPED
  ) {
    return {
      ok:
        classification.scopeClass === CONFIRMED_SCOPE_CLASSES.GLOBAL_UNSCOPED ||
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
  GLOBAL_UNSCOPED_SECTION_STATES,
  EXPLICIT_SCOPE_REQUIRED_ENTRY_TYPES,
  UNscoped_ALLOWED_ENTRY_TYPES,
  readScopeSignature,
  hasAnyExplicitScope,
  isSharedSharedCrossRepo,
  isScopedLocal,
  classifyConfirmedScope,
  getConfirmedScopeRequirement,
  shouldAllowLegacyUnscopedRead,
  shouldIncludeInScopedContext,
  shouldMigrateLegacyUnscopedLater,
  validateConfirmedScopeForWrite,
  buildConfirmedScopePolicySnapshot,
};