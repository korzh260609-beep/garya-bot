// core/projectContextScopePolicyRules.js
// ============================================================================
// Project Context Scope Policy Rules
// Purpose:
// - explicit config-like rules for mapping structured repo object context
//   into Project Memory scope
// - NO free-text parsing
// - NO transport logic
// IMPORTANT:
// - rules are conservative
// - rules should be extended only from structured runtime evidence
// ============================================================================

export const PROJECT_CONTEXT_SCOPE_PROJECT_AREA_RULES = Object.freeze([
  {
    projectArea: "client",
    pathPrefixes: Object.freeze([
      "client/",
      "apps/client/",
      "packages/client/",
    ]),
    entityEquals: Object.freeze([
      "client",
      "repo:client",
    ]),
  },
  {
    projectArea: "docs",
    pathPrefixes: Object.freeze([
      "pillars/",
      "docs/",
    ]),
    entityEquals: Object.freeze([
      "workflow",
      "decisions",
      "roadmap",
      "project",
      "kingdom",
      "repoindex",
      "pillars",
    ]),
  },
  {
    projectArea: "core",
    pathPrefixes: Object.freeze([
      "src/core/",
      "core/",
      "src/bot/",
      "src/tasks/",
      "src/users/",
      "src/services/",
      "src/db/",
      "src/projectmemory/",
    ]),
    entityEquals: Object.freeze([
      "core",
      "repo:core",
    ]),
  },
  {
    projectArea: "connectors",
    pathPrefixes: Object.freeze([
      "src/sources/",
      "src/connectors/",
    ]),
    entityEquals: Object.freeze([
      "connectors",
      "sources",
    ]),
  },
  {
    projectArea: "shared",
    pathPrefixes: Object.freeze([
      "shared/",
      "packages/shared/",
    ]),
    entityEquals: Object.freeze([
      "shared",
      "repo:shared",
    ]),
  },
  {
    projectArea: "infra",
    pathPrefixes: Object.freeze([
      ".github/",
      "infra/",
      "deploy/",
      "deployment/",
    ]),
    pathIncludes: Object.freeze([
      "render.yaml",
      "dockerfile",
    ]),
    entityEquals: Object.freeze([
      "infra",
    ]),
  },
]);

export const PROJECT_CONTEXT_SCOPE_REPO_SCOPE_RULES = Object.freeze([
  {
    repoScope: "client",
    pathPrefixes: Object.freeze([
      "client/",
      "apps/client/",
      "packages/client/",
    ]),
    entityEquals: Object.freeze([
      "client",
      "repo:client",
    ]),
  },
  {
    repoScope: "shared",
    pathPrefixes: Object.freeze([
      "shared/",
      "packages/shared/",
    ]),
    entityEquals: Object.freeze([
      "shared",
      "repo:shared",
    ]),
  },
  {
    repoScope: "core",
    entityEquals: Object.freeze([
      "core",
      "repo:core",
    ]),
  },
]);

export const PROJECT_CONTEXT_SCOPE_LINKED_REPO_RULES = Object.freeze([
  {
    linkedRepo: "client",
    entityEquals: Object.freeze([
      "linked_repo:client",
    ]),
  },
  {
    linkedRepo: "shared",
    entityEquals: Object.freeze([
      "linked_repo:shared",
    ]),
  },
  {
    linkedRepo: "core",
    entityEquals: Object.freeze([
      "linked_repo:core",
    ]),
  },
]);

export const PROJECT_CONTEXT_SCOPE_LINKED_AREA_RULES = Object.freeze([
  {
    linkedArea: "client",
    entityEquals: Object.freeze([
      "linked_area:client",
    ]),
  },
  {
    linkedArea: "shared",
    entityEquals: Object.freeze([
      "linked_area:shared",
    ]),
  },
  {
    linkedArea: "core",
    entityEquals: Object.freeze([
      "linked_area:core",
    ]),
  },
  {
    linkedArea: "docs",
    entityEquals: Object.freeze([
      "linked_area:docs",
    ]),
  },
  {
    linkedArea: "connectors",
    entityEquals: Object.freeze([
      "linked_area:connectors",
    ]),
  },
  {
    linkedArea: "infra",
    entityEquals: Object.freeze([
      "linked_area:infra",
    ]),
  },
]);

export const PROJECT_CONTEXT_SCOPE_CROSS_REPO_RULES = Object.freeze([
  {
    crossRepo: true,
    entityEquals: Object.freeze([
      "linked_repo:client",
      "linked_repo:shared",
      "linked_repo:core",
    ]),
  },
  {
    crossRepo: true,
    pathPrefixes: Object.freeze([
      "shared/",
      "packages/shared/",
    ]),
    entityEquals: Object.freeze([
      "shared",
      "repo:shared",
    ]),
  },
]);

export default {
  PROJECT_CONTEXT_SCOPE_PROJECT_AREA_RULES,
  PROJECT_CONTEXT_SCOPE_REPO_SCOPE_RULES,
  PROJECT_CONTEXT_SCOPE_LINKED_REPO_RULES,
  PROJECT_CONTEXT_SCOPE_LINKED_AREA_RULES,
  PROJECT_CONTEXT_SCOPE_CROSS_REPO_RULES,
};