// AGENT NOTE:
// RepoStateAgent next action plan builder skeleton.
// Purpose: produce deterministic guidance from a project map.
// Do not call AI, execute tools, write files, or override Monarch decisions here.

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasLayer(projectMap = {}, layer) {
  return Number(projectMap?.layers?.[layer]?.filesCount || 0) > 0;
}

export function buildRepoStateNextActionPlan(projectMap = {}) {
  const immediateChecks = [
    {
      id: "verify_repo_facts_are_current",
      title: "Verify repo facts are current before code decisions",
      reason: "Repo intelligence must be source-first and based on current files.",
      target: "repo input snapshot",
    },
  ];

  if (hasLayer(projectMap, "pillars")) {
    immediateChecks.push({
      id: "protect_pillars_from_status_storage",
      title: "Keep pillars as laws, not execution status",
      reason: "Execution state must be derived from code/runtime/tests, not manual status marks in pillars.",
      target: "pillars/",
    });
  }

  if (hasLayer(projectMap, "core")) {
    immediateChecks.push({
      id: "protect_core_from_agent_logic",
      title: "Keep core orchestration thin",
      reason: "Repo agents must not be embedded into core or message handlers.",
      target: "src/core/",
    });
  }

  const suggestedNextSteps = [];

  if (!hasLayer(projectMap, "repo_maintenance_agents")) {
    suggestedNextSteps.push({
      id: "add_repo_maintenance_skeleton",
      title: "Add RepoMaintenanceAgent skeleton",
      priority: "high",
      reason: "RepoStateAgent should not absorb after-change audit responsibility.",
    });
  }

  suggestedNextSteps.push({
    id: "add_repo_state_smoke_later",
    title: "Add deterministic repo-agent smoke test later",
    priority: "medium",
    reason: "Smoke tests should verify no tokens, no writes, and stable output shape.",
  });

  const blockedActions = [
    {
      id: "no_runtime_connection_without_block_approval",
      action: "Do not connect repo agents to Telegram/runtime until the skeleton and contracts are reviewed.",
    },
    {
      id: "no_ai_calls_from_repo_state_v1",
      action: "Do not call AI from RepoStateAgent V1. It must stay deterministic.",
    },
    {
      id: "no_repo_writes_from_agents",
      action: "Repo-facing agents must not write repo files unless a later explicit gated mode is approved.",
    },
  ];

  return {
    schemaVersion: 1,
    generatedBy: "repo_state_next_action_plan_builder_v1",
    tokensSpent: false,
    canChangeState: false,
    basedOn: {
      projectMapSchemaVersion: projectMap?.schemaVersion || null,
      files: projectMap?.totals?.files || 0,
      modules: projectMap?.totals?.modules || 0,
      layers: Object.keys(projectMap?.layers || {}),
    },
    immediateChecks,
    suggestedNextSteps,
    blockedActions,
    recommendedReadOrder: asArray(projectMap?.criticalFiles).map((file) => file.path).slice(0, 25),
  };
}

export default buildRepoStateNextActionPlan;
