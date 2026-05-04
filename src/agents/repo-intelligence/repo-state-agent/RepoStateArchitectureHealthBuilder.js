// AGENT NOTE:
// RepoStateAgent architecture health builder skeleton.
// Purpose: produce deterministic no-AI architecture risk hints from a project map.
// Do not call AI, read external sources, write files, or change runtime state here.

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function layerCount(projectMap = {}, layer) {
  return Number(projectMap?.layers?.[layer]?.filesCount || 0);
}

function hasLayer(projectMap = {}, layer) {
  return layerCount(projectMap, layer) > 0;
}

function addFinding(findings, finding) {
  findings.push({
    severity: "info",
    ...finding,
  });
}

function buildFindings(projectMap = {}) {
  const findings = [];

  if (hasLayer(projectMap, "pillars")) {
    addFinding(findings, {
      id: "pillars_present",
      severity: "high",
      area: "governance",
      title: "Pillars are present and protected",
      detail: "Pillars define rules and architecture. They must not be treated as execution status storage.",
    });
  }

  if (hasLayer(projectMap, "transport")) {
    addFinding(findings, {
      id: "transport_boundary_present",
      severity: "high",
      area: "transport_boundary",
      title: "Transport boundary exists",
      detail: "Transport must stay adapter-only and must not own AI, memory, permissions, or sources.",
    });
  }

  if (hasLayer(projectMap, "core")) {
    addFinding(findings, {
      id: "core_boundary_present",
      severity: "high",
      area: "core_boundary",
      title: "Core boundary exists",
      detail: "Core should coordinate modules and must not absorb repo agents, memory, sources, or task logic.",
    });
  }

  if (hasLayer(projectMap, "repo_intelligence_agents")) {
    addFinding(findings, {
      id: "repo_intelligence_agents_present",
      severity: "medium",
      area: "agents",
      title: "Repo intelligence agent boundary exists",
      detail: "RepoStateAgent should answer what exists in the repository, not what to change after a commit.",
    });
  }

  if (hasLayer(projectMap, "repo_maintenance_agents")) {
    addFinding(findings, {
      id: "repo_maintenance_agents_present",
      severity: "medium",
      area: "agents",
      title: "Repo maintenance agent boundary exists",
      detail: "RepoMaintenanceAgent should audit consequences of changes and remain read-only by default.",
    });
  }

  if (Number(projectMap?.totals?.files || 0) === 0) {
    addFinding(findings, {
      id: "empty_project_map_input",
      severity: "medium",
      area: "input_quality",
      title: "Project map has no files",
      detail: "RepoStateAgent needs actual repo facts to produce useful guidance.",
    });
  }

  return findings;
}

function buildScore(findings = []) {
  const penaltyBySeverity = {
    info: 1,
    low: 3,
    medium: 8,
    high: 15,
    critical: 30,
  };

  const penalty = asArray(findings).reduce((sum, finding) => {
    return sum + (penaltyBySeverity[finding.severity] || 1);
  }, 0);

  return Math.max(0, Math.min(100, 100 - penalty));
}

export function buildRepoStateArchitectureHealth(projectMap = {}) {
  const findings = buildFindings(projectMap);
  const score = buildScore(findings);

  return {
    schemaVersion: 1,
    generatedBy: "repo_state_architecture_health_builder_v1",
    tokensSpent: false,
    canChangeState: false,
    score,
    status: score >= 80 ? "watch" : score >= 60 ? "needs_attention" : "high_risk",
    findings,
    recommendedFocus: findings
      .filter((finding) => ["critical", "high", "medium"].includes(finding.severity))
      .map((finding) => ({
        id: finding.id,
        area: finding.area,
        severity: finding.severity,
        title: finding.title,
      })),
  };
}

export default buildRepoStateArchitectureHealth;
