// ============================================================================
// === src/core/stageCheck/real/profileSkeleton/profileContracts.js
// === non-runtime skeleton: profile contract factories
// ============================================================================

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((x) => String(x || "").trim()).filter(Boolean))]
    : [];
}

export function createEvidenceContract({
  weakSignals = [],
  strongSignals = [],
  implementationSignals = [],
  runtimeSignals = [],
  contextSignals = [],
} = {}) {
  return {
    weakSignals: normalizeStringArray(weakSignals),
    strongSignals: normalizeStringArray(strongSignals),
    implementationSignals: normalizeStringArray(implementationSignals),
    runtimeSignals: normalizeStringArray(runtimeSignals),
    contextSignals: normalizeStringArray(contextSignals),
  };
}

export function createExactPolicy({
  allowPartialWithoutReachability = false,
  requireOwnImplementation = false,
  preferRuntimeEvidence = false,
  strongSignalThreshold = 2,
  implementationAnchorThreshold = 2,
} = {}) {
  return {
    allowPartialWithoutReachability: !!allowPartialWithoutReachability,
    requireOwnImplementation: !!requireOwnImplementation,
    preferRuntimeEvidence: !!preferRuntimeEvidence,
    strongSignalThreshold: Number(strongSignalThreshold || 0),
    implementationAnchorThreshold: Number(implementationAnchorThreshold || 0),
  };
}

export function createAggregatePolicy({
  allowChildLift = false,
  requireNonUnknownBaseForChildLift = true,
  requireReachabilityForComplete = true,
  minChildPartialCount = 2,
  minActiveRatio = 0.18,
} = {}) {
  return {
    allowChildLift: !!allowChildLift,
    requireNonUnknownBaseForChildLift: !!requireNonUnknownBaseForChildLift,
    requireReachabilityForComplete: !!requireReachabilityForComplete,
    minChildPartialCount: Number(minChildPartialCount || 0),
    minActiveRatio: Number(minActiveRatio || 0),
  };
}

export function createNodeProfile({
  key = "generic.default",
  family = "generic",
  semanticTags = [],
  titleHints = [],
  evidence = {},
  exact = {},
  aggregate = {},
} = {}) {
  return {
    key: String(key || "generic.default"),
    family: String(family || "generic"),
    semanticTags: normalizeStringArray(semanticTags),
    titleHints: normalizeStringArray(titleHints),
    evidence: createEvidenceContract(evidence),
    exact: createExactPolicy(exact),
    aggregate: createAggregatePolicy(aggregate),
  };
}

export default {
  createEvidenceContract,
  createExactPolicy,
  createAggregatePolicy,
  createNodeProfile,
};