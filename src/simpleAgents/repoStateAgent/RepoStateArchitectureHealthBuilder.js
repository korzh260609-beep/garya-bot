// src/simpleAgents/repoStateAgent/RepoStateArchitectureHealthBuilder.js
// ============================================================================
// Repo State Architecture Health Builder
// Deterministic no-AI architecture health summary from projectMap/semanticMap.
// This file must never spend tokens.
// ============================================================================

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
    status: "observed",
    ...finding,
  });
}

function buildFindings(projectMap = {}) {
  const findings = [];
  const totals = projectMap?.totals || {};
  const semanticMap = projectMap?.semanticMap || {};
  const dependencies = projectMap?.dependencies || {};

  if (Number(totals.files || 0) > 900) {
    addFinding(findings, {
      id: "large_repo_requires_maps",
      severity: "medium",
      area: "context_efficiency",
      title: "Large repository requires map-first navigation",
      detail: "Agents should use projectMap, semanticMap, and nextActionPlan before reading broad file sets.",
    });
  }

  if (Number(dependencies.unresolvedInternalCount || 0) > 0) {
    addFinding(findings, {
      id: "unresolved_internal_dependencies_present",
      severity: "high",
      area: "dependency_integrity",
      title: "Unresolved internal dependencies are present",
      detail: "Refactors touching imports should verify unresolved dependency records first.",
    });
  }

  if (hasLayer(projectMap, "pillars")) {
    addFinding(findings, {
      id: "pillars_are_present_and_protected",
      severity: "high",
      area: "governance",
      title: "Pillars are present and protected",
      detail: "Pillars must remain read-only unless Monarch explicitly permits a pillars edit.",
    });
  }

  if (hasLayer(projectMap, "transport")) {
    addFinding(findings, {
      id: "transport_must_remain_multitransport",
      severity: "high",
      area: "transport_boundary",
      title: "Transport must remain multitransport-neutral",
      detail: "Telegram is the current adapter, not the architecture dependency for SG.",
    });
  }

  if (hasLayer(projectMap, "legacy_core") || hasLayer(projectMap, "fix_artifacts")) {
    addFinding(findings, {
      id: "legacy_root_artifacts_need_review",
      severity: "medium",
      area: "cleanup_review",
      title: "Legacy root artifacts need review before cleanup",
      detail: "Root legacy/fix artifacts should be reviewed and documented before any removal or migration.",
    });
  }

  if (semanticMap?.tokensSpent === true) {
    addFinding(findings, {
      id: "unexpected_semantic_map_token_spend",
      severity: "critical",
      area: "ai_spending_safety",
      title: "Semantic map unexpectedly spent tokens",
      detail: "Semantic map generation is expected to stay deterministic and no-AI unless explicitly changed.",
    });
  }

  return findings;
}

function buildScore(findings = []) {
  const penalties = {
    info: 1,
    low: 3,
    medium: 8,
    high: 15,
    critical: 30,
  };

  const totalPenalty = findings.reduce((sum, finding) => {
    return sum + (penalties[finding.severity] || 1);
  }, 0);

  return Math.max(0, Math.min(100, 100 - totalPenalty));
}

function buildRecommendedFocus(findings = []) {
  return findings
    .filter((finding) => ["critical", "high", "medium"].includes(finding.severity))
    .slice(0, 6)
    .map((finding) => ({
      findingId: finding.id,
      area: finding.area,
      title: finding.title,
      priority: finding.severity,
    }));
}

export function buildRepoStateArchitectureHealth(projectMap = {}) {
  const findings = buildFindings(projectMap);
  const score = buildScore(findings);

  return {
    schemaVersion: 1,
    generatedBy: "deterministic_architecture_health_v1",
    tokensSpent: false,
    score,
    status: score >= 80 ? "watch" : score >= 60 ? "needs_attention" : "high_risk",
    findings,
    recommendedFocus: buildRecommendedFocus(findings),
    counters: {
      findings: findings.length,
      critical: findings.filter((item) => item.severity === "critical").length,
      high: findings.filter((item) => item.severity === "high").length,
      medium: findings.filter((item) => item.severity === "medium").length,
      low: findings.filter((item) => item.severity === "low").length,
      info: findings.filter((item) => item.severity === "info").length,
      taskRoutingHints: asArray(projectMap?.semanticMap?.taskRoutingHints).length,
      taskSafetyGates: asArray(projectMap?.semanticMap?.taskSafetyGates).length,
      recommendedReadOrder: asArray(projectMap?.semanticMap?.recommendedReadOrder).length,
    },
  };
}

export default buildRepoStateArchitectureHealth;
