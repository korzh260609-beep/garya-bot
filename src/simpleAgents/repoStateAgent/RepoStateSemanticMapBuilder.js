// src/simpleAgents/repoStateAgent/RepoStateSemanticMapBuilder.js
// ============================================================================
// Repo State Semantic Map Builder
// Deterministic no-AI semantic layer for the repo project map.
// No tokens are spent here.
// ============================================================================

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function includesAny(text, tokens = []) {
  const lower = normalizeString(text).toLowerCase();
  return tokens.some((token) => lower.includes(token));
}

function describeLayer(layer = "") {
  const key = normalizeString(layer);

  const descriptions = {
    entrypoint: "Application boot entrypoints and startup wiring.",
    root_ai_adapter: "Root-level AI adapter that wraps model calls and AI usage accounting for the app.",
    root_database_adapter: "Root-level database adapter that exposes shared persistence access for runtime code.",
    root_model_config: "Root-level model configuration for AI routing defaults and cost-level model selection.",
    root_project_memory_adapter: "Root-level project memory adapter kept for compatibility with memory workflows.",
    root_sources_adapter: "Root-level sources adapter kept for compatibility with source access workflows.",
    root_prompt_config: "Root-level prompt configuration and system prompt material.",
    root_package_config: "Root-level package/dependency configuration and npm script metadata.",
    root_docs: "Root-level repository documentation for humans and coding agents.",
    root_env_template: "Root-level environment variable template for deployment/configuration setup.",
    bootstrap: "System initialization, startup safety checks, and boot-time wiring.",
    transport: "Telegram/chat transport, command routing, and user-facing handlers.",
    core: "Core orchestration, message handling, memory and shared runtime services.",
    http: "HTTP server, webhooks, and external request boundaries.",
    integrations: "External service integrations such as Render, GitHub, APIs, and providers.",
    jobs: "Background jobs, scheduled work, and worker-like execution.",
    database: "Database migrations, persistence, repositories, and storage schema.",
    access_control: "Access rules, group policies, permissions, and authorization boundaries.",
    capabilities: "Capability registry and feature availability surfaces.",
    code_output: "Code response formatting and code-output helpers.",
    decision: "Decision logic, diagnostics, and intent/action decision flows.",
    documents: "Document intake, parsing, estimation, and document-related services.",
    logging: "Logging, diagnostics, observability adapters, and error analysis utilities.",
    media: "Media and attachment processing utilities.",
    memory: "Memory storage, recall, context, and user/project memory helpers.",
    observability: "Runtime metrics, diagnostics, and operational visibility.",
    project_experience: "Project experience memory, lessons, and accumulated project knowledge.",
    project_memory: "Project memory storage, confirmation, restore, and retrieval services.",
    repository_access: "Repository access helpers and source-code retrieval utilities.",
    robot_layer: "Deterministic robot-layer logic that should work without AI token spending.",
    services: "Shared service layer used by transports, tasks, and core workflows.",
    sources: "Source adapters and external data-source layer.",
    tasks: "Task engine entities, scheduling, execution, and task lifecycle logic.",
    users: "User identity, roles, profiles, and user-level settings.",
    vision: "Vision, image, and visual-analysis related processing.",
    repo_state_collector: "Repository scanning, file tree collection, dependency extraction, and project state snapshots.",
    agent_workspace: "Runtime code for the controlled workspace command bridge and report writing.",
    agent_workspace_reports: "Markdown command/report files used as the controlled bridge between Advisor and SG.",
    simple_agents: "Small focused agents and analysis services built around the project state.",
    pillars: "Project governance and architecture source-of-truth documents. Read-only unless Monarch explicitly allows edits.",
    devops: "Development operations, CI, GitHub workflows, scripts, and deployment helpers.",
    diagnostics: "Repository-level diagnostic scripts and checks outside the runtime app.",
    docs: "Documentation and legacy notes outside pillars governance.",
    archive: "Archived or unused materials kept for reference.",
    other: "Unclassified or supporting files outside the main architectural layers.",
  };

  return descriptions[key] || descriptions.other;
}

function classifyResponsibility(path = "", layer = "") {
  const normalizedPath = normalizeString(path).toLowerCase();
  const normalizedLayer = normalizeString(layer).toLowerCase();

  if (includesAny(normalizedPath, ["migration", "repository", "repo", "store", "db"])) {
    return "persistence";
  }

  if (includesAny(normalizedPath, ["command", "dispatcher", "handler", "router", "route"])) {
    return "command_or_routing";
  }

  if (includesAny(normalizedPath, ["diag", "diagnostic", "selftest", "test"])) {
    return "diagnostics";
  }

  if (includesAny(normalizedPath, ["config", "policy", "permission", "access", "guard"])) {
    return "configuration_or_policy";
  }

  if (includesAny(normalizedPath, ["render", "github", "openai", "telegram", "api", "integration"])) {
    return "external_integration";
  }

  if (includesAny(normalizedPath, ["memory", "projectmemory", "recall"])) {
    return "memory";
  }

  if (includesAny(normalizedPath, ["agent", "semantic", "analysis", "analyzer", "collector", "map"])) {
    return "agent_analysis";
  }

  if (normalizedLayer === "entrypoint") return "startup";
  if (normalizedLayer === "bootstrap") return "startup";
  if (normalizedLayer === "database") return "persistence";
  if (normalizedLayer === "root_ai_adapter") return "external_integration";
  if (normalizedLayer === "root_database_adapter") return "persistence";
  if (normalizedLayer === "root_model_config") return "configuration_or_policy";
  if (normalizedLayer === "root_project_memory_adapter") return "memory";
  if (normalizedLayer === "root_sources_adapter") return "source_adapter";
  if (normalizedLayer === "root_prompt_config") return "configuration_or_policy";
  if (normalizedLayer === "root_package_config") return "configuration_or_policy";
  if (normalizedLayer === "root_docs") return "documentation";
  if (normalizedLayer === "root_env_template") return "configuration_or_policy";
  if (normalizedLayer === "transport") return "user_interaction";
  if (normalizedLayer === "agent_workspace") return "workspace_bridge";
  if (normalizedLayer === "agent_workspace_reports") return "workspace_report";
  if (normalizedLayer === "simple_agents") return "agent_analysis";
  if (normalizedLayer === "sources") return "source_adapter";
  if (normalizedLayer === "tasks") return "task_lifecycle";
  if (normalizedLayer === "users") return "user_management";

  return "supporting_code";
}

function inferModulePurpose(module = {}) {
  const key = normalizeString(module?.key || module?.moduleKey || module?.name || "unknown");
  const layer = normalizeString(module?.layer || "other");
  const rootPath = normalizeString(module?.rootPath || key);
  const sampleFiles = asArray(module?.sampleFiles || module?.files).map((file) => {
    return typeof file === "string" ? file : file?.path;
  }).filter(Boolean);

  const responsibilities = Array.from(new Set(
    sampleFiles.map((path) => classifyResponsibility(path, layer))
  ));

  return {
    moduleKey: key,
    layer,
    rootPath,
    purpose: describeLayer(layer),
    responsibilities: responsibilities.length ? responsibilities.slice(0, 8) : [classifyResponsibility(rootPath, layer)],
    sampleFiles: sampleFiles.slice(0, 8),
  };
}

function inferFilePurpose(file = {}) {
  const path = normalizeString(file?.path || "");
  const layer = normalizeString(file?.layer || "other");

  return {
    path,
    layer,
    responsibility: classifyResponsibility(path, layer),
    purposeHint: describeLayer(layer),
  };
}

function buildBoundaryRules() {
  return [
    {
      rule: "pillars_read_only",
      meaning: "Files under pillars/ are source-of-truth documents and must not be edited unless Monarch explicitly allows it.",
    },
    {
      rule: "workspace_reports_only",
      meaning: "agent_workspace/ is a controlled command/report bridge; SG writes only allowlisted markdown reports there.",
    },
    {
      rule: "repo_state_first",
      meaning: "Repository state must be checked before architecture claims, code edits, or module planning.",
    },
    {
      rule: "no_real_ai_without_allow_real_ai",
      meaning: "Real AI analysis requires explicit allowRealAi=true and Monarch approval.",
    },
  ];
}

function buildRiskHints(projectMap = {}) {
  const totals = projectMap?.totals || {};
  const dependencies = projectMap?.dependencies || {};
  const hints = [];

  if (Number(totals.files || 0) > 500) {
    hints.push({
      risk: "large_repo_context",
      meaning: "Repository has many files; agents should rely on projectMap and targeted file reads instead of broad guessing.",
    });
  }

  if (Number(dependencies.unresolvedInternalCount || 0) > 0) {
    hints.push({
      risk: "unresolved_internal_dependencies",
      meaning: "Some internal imports may be unresolved; verify before refactoring related modules.",
    });
  }

  if (projectMap?.layers?.pillars?.filesCount > 0) {
    hints.push({
      risk: "pillar_mutation_risk",
      meaning: "Pillars are present and protected; accidental edits would violate project rules.",
    });
  }

  return hints;
}

export function buildRepoStateSemanticMap(projectMap = {}) {
  const modules = asArray(projectMap?.modules);
  const entrypoints = asArray(projectMap?.entrypoints);
  const criticalFiles = asArray(projectMap?.criticalFiles);
  const commandLikeFiles = asArray(projectMap?.commandLikeFiles);

  return {
    schemaVersion: 3,
    generatedBy: "deterministic_semantic_map_v3",
    tokensSpent: false,
    purpose: "No-AI semantic layer that helps SG and external coding tools understand module purposes and boundaries.",
    layerDescriptions: Object.keys(projectMap?.layers || {}).reduce((acc, layer) => {
      acc[layer] = describeLayer(layer);
      return acc;
    }, {}),
    modulePurposes: modules.map(inferModulePurpose),
    keyFilePurposes: {
      entrypoints: entrypoints.map(inferFilePurpose),
      criticalFiles: criticalFiles.map(inferFilePurpose),
      commandLikeFiles: commandLikeFiles.slice(0, 80).map(inferFilePurpose),
    },
    boundaryRules: buildBoundaryRules(),
    riskHints: buildRiskHints(projectMap),
  };
}

export default buildRepoStateSemanticMap;
