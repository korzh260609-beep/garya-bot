// src/simpleAgents/repoStateAgent/RepoStateNextActionPlanBuilder.js
// ============================================================================
// Repo State Next Action Plan Builder
// Builds deterministic no-AI next-action guidance from projectMap/semanticMap.
// This file must never spend tokens.
// ============================================================================

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasLayer(projectMap = {}, layer) {
  return Boolean(projectMap?.layers?.[layer]);
}

function buildImmediateChecks(projectMap = {}) {
  const semanticMap = projectMap?.semanticMap || {};
  const checks = [];

  checks.push({
    id: "verify_repo_state_freshness",
    title: "Verify repo state freshness",
    reason: "Repository state is the source of truth before architecture or code decisions.",
    target: "agent_workspace/TEST_REPORT.md",
  });

  if (semanticMap?.tokensSpent === true) {
    checks.push({
      id: "investigate_unexpected_token_spend",
      title: "Investigate unexpected token spend",
      reason: "Deterministic repo-state work should not spend AI tokens unless explicitly approved.",
      target: "aiUsage / aiMeta",
    });
  }

  if (hasLayer(projectMap, "pillars")) {
    checks.push({
      id: "protect_pillars_before_changes",
      title: "Protect pillars before changes",
      reason: "Pillars are governance/source-of-truth files and are read-only without explicit Monarch permission.",
      target: "pillars/",
    });
  }

  if (hasLayer(projectMap, "transport")) {
    checks.push({
      id: "preserve_multitransport_boundary",
      title: "Preserve multitransport boundary",
      reason: "SG is a multitransport project; Telegram is the current adapter, not the architecture dependency.",
      target: "src/transport/ and src/bot/",
    });
  }

  return checks;
}

function buildSuggestedNextSteps(projectMap = {}) {
  const semanticMap = projectMap?.semanticMap || {};
  const steps = [];

  if (asArray(semanticMap?.taskSafetyGates).length > 0) {
    steps.push({
      id: "wire_safety_gates_into_reports",
      title: "Use taskSafetyGates before selecting files for a task",
      type: "deterministic_guidance",
      priority: "high",
      targetLayers: ["simple_agents", "agent_workspace"],
      startFiles: [
        "src/simpleAgents/repoStateAgent/RepoStateSemanticMapBuilder.js",
        "src/agentWorkspace/AgentWorkspaceReportBuilders.js",
      ],
    });
  }

  if (asArray(semanticMap?.recommendedReadOrder).length > 0) {
    steps.push({
      id: "use_recommended_read_order_for_context_restore",
      title: "Use recommendedReadOrder for future context restore and agent onboarding",
      type: "context_efficiency",
      priority: "high",
      targetLayers: ["agent_workspace_reports", "simple_agents"],
      startFiles: [
        "agent_workspace/SEMANTIC_MAP_REPORT.md",
        "src/simpleAgents/repoStateAgent/RepoStateSemanticMapBuilder.js",
      ],
    });
  }

  if (hasLayer(projectMap, "legacy_core") || hasLayer(projectMap, "fix_artifacts")) {
    steps.push({
      id: "review_legacy_root_artifacts",
      title: "Review legacy root artifacts without deleting them",
      type: "cleanup_review",
      priority: "medium",
      targetLayers: ["legacy_core", "fix_artifacts"],
      startFiles: ["core/", "fix/"],
    });
  }

  steps.push({
    id: "snapshot_after_verified_green_check",
    title: "Create snapshot branch after verified green check",
    type: "rollback_safety",
    priority: "medium",
    targetLayers: ["devops"],
    startFiles: ["main branch commit SHA"],
  });

  return steps;
}

function buildBlockedActions() {
  return [
    {
      id: "no_pillars_edits_without_explicit_permission",
      action: "Do not edit pillars/ files unless Monarch explicitly says: разрешаю изменить pillars.",
    },
    {
      id: "no_real_ai_without_explicit_permission",
      action: "Do not run real AI analysis or allowRealAi=true unless Monarch explicitly approves token spending.",
    },
    {
      id: "no_telegram_lock_in",
      action: "Do not design SG as Telegram-dependent; keep transport logic adapter-based and multitransport-ready.",
    },
    {
      id: "no_memory_boundary_merge",
      action: "Do not merge personal, group, project, and SG global memory scopes without explicit architecture change approval.",
    },
  ];
}

export function buildRepoStateNextActionPlan(projectMap = {}) {
  const semanticMap = projectMap?.semanticMap || {};

  return {
    schemaVersion: 1,
    generatedBy: "deterministic_next_action_plan_v1",
    tokensSpent: false,
    basedOn: {
      projectMapSchemaVersion: projectMap?.schemaVersion || null,
      semanticMapSchemaVersion: semanticMap?.schemaVersion || null,
      semanticMapGeneratedBy: semanticMap?.generatedBy || null,
    },
    immediateChecks: buildImmediateChecks(projectMap),
    suggestedNextSteps: buildSuggestedNextSteps(projectMap),
    blockedActions: buildBlockedActions(),
    recommendedReadOrder: asArray(semanticMap?.recommendedReadOrder),
    note: "This deterministic plan is guidance only. It must not override Monarch instructions or project architecture rules.",
  };
}

export default buildRepoStateNextActionPlan;
