// src/memory/project/projectMemoryTypes.js
// SG 2.0 — Project Memory Types Skeleton
//
// Purpose:
// - Define stable project memory item shapes and labels.
// - Keep this file deterministic and dependency-free.
// - No DB access, no transport logic, no AI calls, no source fetching.

export const PROJECT_MEMORY_VERSION = 1;

export const PROJECT_MEMORY_TYPES = Object.freeze({
  ARCHITECTURE_DECISION: "architecture_decision",
  WORKFLOW_RULE: "workflow_rule",
  MODULE_BOUNDARY: "module_boundary",
  IMPLEMENTATION_STATUS: "implementation_status",
  ROLLBACK_POINT: "rollback_point",
  KNOWN_RISK: "known_risk",
  PROJECT_TERMINOLOGY: "project_terminology",
  MONARCH_APPROVED_PRINCIPLE: "monarch_approved_principle",
  IMPORTED_MAIN_IDEA: "imported_main_idea",
});

export const PROJECT_MEMORY_SCOPES = Object.freeze({
  GLOBAL_PROJECT: "global_project",
  MODULE: "module",
  WORKFLOW: "workflow",
  RUNTIME: "runtime",
  REPOSITORY: "repository",
});

export const PROJECT_MEMORY_TRUST = Object.freeze({
  CONFIRMED: "confirmed",
  CANDIDATE: "candidate",
  DEPRECATED: "deprecated",
  NEEDS_REVIEW: "needs_review",
});

export const PROJECT_MEMORY_SOURCE_TYPES = Object.freeze({
  PILLAR: "pillar",
  REPOSITORY_FILE: "repository_file",
  RUNTIME_REPORT: "runtime_report",
  COMMIT: "commit",
  PR: "pull_request",
  ACTIONS_RUN: "actions_run",
  RENDER_FACT: "render_fact",
  MONARCH_APPROVAL: "monarch_approval",
  OLD_MAIN_REVIEW: "old_main_review",
});

export function createProjectMemoryItem({
  type = PROJECT_MEMORY_TYPES.ARCHITECTURE_DECISION,
  title = "",
  content = "",
  scope = PROJECT_MEMORY_SCOPES.GLOBAL_PROJECT,
  trust = PROJECT_MEMORY_TRUST.CANDIDATE,
  sourceType = null,
  sourceRef = null,
  tags = [],
  metadata = {},
} = {}) {
  return {
    version: PROJECT_MEMORY_VERSION,
    type,
    title: typeof title === "string" ? title : String(title ?? ""),
    content: typeof content === "string" ? content : String(content ?? ""),
    scope,
    trust,
    sourceType,
    sourceRef: sourceRef ? String(sourceRef) : null,
    tags: Array.isArray(tags) ? tags.map((tag) => String(tag)) : [],
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  };
}

export default {
  PROJECT_MEMORY_VERSION,
  PROJECT_MEMORY_TYPES,
  PROJECT_MEMORY_SCOPES,
  PROJECT_MEMORY_TRUST,
  PROJECT_MEMORY_SOURCE_TYPES,
  createProjectMemoryItem,
};
