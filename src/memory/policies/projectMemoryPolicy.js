// src/memory/policies/projectMemoryPolicy.js
// SG 2.0 — Project Memory Policy Skeleton
//
// Purpose:
// - Ensure project memory supports source-first project reasoning.
// - Deterministic and dependency-free.
// - No DB access, no transport logic, no AI calls, no source fetching.

export const PROJECT_MEMORY_POLICY_VERSION = 1;

export function getProjectMemoryPolicy() {
  return {
    version: PROJECT_MEMORY_POLICY_VERSION,
    sourceFirst: true,
    projectMemoryDoesNotReplacePillars: true,
    projectMemoryDoesNotReplaceRepositoryFacts: true,
    projectMemoryDoesNotReplaceRuntimeFacts: true,
    confirmedProjectMemoryPriority: "below_verified_sources",
    allowedScopes: ["project", "module", "workflow", "runtime", "repository"],
    forbidden: [
      "treat_project_memory_as_pillars",
      "override_current_repo_facts_with_memory",
      "override_runtime_reports_with_memory",
      "store_unverified_guess_as_confirmed_project_memory",
      "store_secret_or_env_value",
      "copy_old_main_implementation_without_review",
    ],
  };
}

export function assertProjectMemoryCandidateAllowed({
  hasContent = false,
  hasSource = false,
  sourceReviewed = false,
  containsSecret = false,
  conflictsWithVerifiedSource = false,
  monarchApproved = false,
} = {}) {
  const errors = [];
  const warnings = [];

  if (!hasContent) errors.push("missing_content");
  if (!hasSource) warnings.push("missing_source_reference");
  if (!sourceReviewed) warnings.push("source_not_reviewed");
  if (containsSecret) errors.push("contains_secret");
  if (conflictsWithVerifiedSource) errors.push("conflicts_with_verified_source");

  if (!monarchApproved) {
    warnings.push("not_monarch_approved_confirmed_memory");
  }

  return {
    ok: errors.length === 0,
    decision: errors.length === 0 ? "ALLOW_CANDIDATE" : "BLOCK_PROJECT_MEMORY",
    requiresApproval: !monarchApproved,
    errors,
    warnings,
    policy: getProjectMemoryPolicy(),
  };
}

export default {
  PROJECT_MEMORY_POLICY_VERSION,
  getProjectMemoryPolicy,
  assertProjectMemoryCandidateAllowed,
};
