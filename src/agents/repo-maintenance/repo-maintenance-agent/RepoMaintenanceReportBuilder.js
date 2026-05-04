// AGENT NOTE:
// RepoMaintenanceAgent report builder skeleton.
// Purpose: produce deterministic read-only maintenance recommendations after repo changes.
// Do not write files, run tests, call AI, deploy, or change external state here.

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(path) {
  return String(path || "").trim().replace(/^\.\//, "");
}

function classifyChangedArea(path = "") {
  const normalized = normalizePath(path).toLowerCase();

  if (normalized.startsWith("pillars/")) return "pillars";
  if (normalized.startsWith("docs/")) return "docs";
  if (normalized.startsWith("src/agents/repo-intelligence/")) return "repo_intelligence_agents";
  if (normalized.startsWith("src/agents/repo-maintenance/")) return "repo_maintenance_agents";
  if (normalized.startsWith("src/agents/")) return "agents";
  if (normalized.startsWith("src/core/")) return "core";
  if (normalized.startsWith("src/transport/")) return "transport";
  if (normalized.startsWith("src/delivery/")) return "delivery";
  if (normalized.startsWith("src/ai/")) return "ai";
  if (normalized.startsWith("src/config/")) return "config";
  if (normalized.startsWith("src/permissions/")) return "permissions";
  if (normalized.startsWith("src/users/")) return "users";
  if (normalized.startsWith(".github/") || normalized.startsWith("scripts/")) return "devops";
  if (["index.js", "package.json", ".env.example"].includes(normalized)) return "runtime_contract";

  return "other";
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function buildRecommendedChecks(areas = []) {
  const checks = [];

  if (areas.includes("pillars")) {
    checks.push({
      id: "check_pillars_are_rules_not_status",
      title: "Check pillars remain rules, not execution status storage",
      target: "pillars/",
    });
  }

  if (areas.includes("core")) {
    checks.push({
      id: "check_core_boundary",
      title: "Check core stayed coordinator-only",
      target: "src/core/",
    });
  }

  if (areas.includes("transport") || areas.includes("delivery")) {
    checks.push({
      id: "check_transport_boundary",
      title: "Check transport/delivery did not absorb AI, memory, permissions, or source logic",
      target: "src/transport/ and src/delivery/",
    });
  }

  if (areas.includes("ai")) {
    checks.push({
      id: "check_ai_wrapper_boundary",
      title: "Check AI calls still go through controlled wrapper/config",
      target: "src/ai/",
    });
  }

  if (areas.some((area) => area.includes("agents"))) {
    checks.push({
      id: "check_agent_boundaries",
      title: "Check agents remain separated by responsibility and read-only by default",
      target: "src/agents/",
    });
  }

  checks.push({
    id: "manual_runtime_smoke_if_runtime_changed",
    title: "Run manual runtime smoke only if runtime files changed",
    target: "Telegram / health endpoint",
  });

  return checks;
}

function buildRisks(areas = []) {
  const risks = [];

  if (areas.includes("runtime_contract")) {
    risks.push({
      level: "high",
      reason: "Runtime contract files changed. Render compatibility may be affected.",
    });
  }

  if (areas.includes("core")) {
    risks.push({
      level: "high",
      reason: "Core changed. Risk of turning coordinator into monolith.",
    });
  }

  if (areas.includes("pillars")) {
    risks.push({
      level: "medium",
      reason: "Pillars changed. Risk of mixing rules with execution status.",
    });
  }

  if (areas.some((area) => area.includes("agents"))) {
    risks.push({
      level: "medium",
      reason: "Agent files changed. Risk of responsibility mixing or hidden runtime behavior.",
    });
  }

  if (!risks.length) {
    risks.push({
      level: "low",
      reason: "No high-risk areas detected from changed file paths alone.",
    });
  }

  return risks;
}

export function buildRepoMaintenanceReport(input = {}) {
  const changedFiles = asArray(input.changedFiles).map(normalizePath).filter(Boolean);
  const impactedAreas = unique(changedFiles.map(classifyChangedArea));
  const recommendedChecks = buildRecommendedChecks(impactedAreas);
  const risks = buildRisks(impactedAreas);
  const highestRisk = risks.some((risk) => risk.level === "high")
    ? "high"
    : risks.some((risk) => risk.level === "medium")
      ? "medium"
      : "low";

  return {
    schemaVersion: 1,
    generatedBy: "repo_maintenance_report_builder_v1",
    tokensSpent: false,
    canChangeState: false,
    changedFiles,
    impactedAreas,
    recommendedChecks,
    risks,
    riskLevel: highestRisk,
    snapshotRecommended: highestRisk !== "low",
    suggestedNextActions: [
      "Review changed files manually.",
      "Run only relevant smoke checks.",
      "Create rollback/snapshot after checks are green.",
    ],
  };
}

export default buildRepoMaintenanceReport;
