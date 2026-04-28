// src/simpleAgents/repoStateAgent/RepoStateAgentAiAnalyzer.js
// ============================================================================
// Repo State Agent AI Analyzer
// Optional AI layer over project map.
// ============================================================================

import { callAI } from "../../../ai.js";
import { getRepoStateAgentConfig } from "./RepoStateAgentConfig.js";

function compactArray(items, limit, mapper) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, limit).map(mapper);
}

function compactModule(module = {}) {
  return {
    key: module.key || module.moduleKey || module.name || "-",
    layer: module.layer || "-",
    files: module.filesCount ?? module.fileCount ?? (Array.isArray(module.files) ? module.files.length : 0),
    mainFiles: Array.isArray(module.files)
      ? module.files.slice(0, 5).map((file) => typeof file === "string" ? file : file?.path).filter(Boolean)
      : [],
  };
}

function compactModuleLink(link = {}) {
  return {
    from: link.from || link.source || link.sourceModule || "-",
    to: link.to || link.target || link.targetModule || "-",
    type: link.type || link.reason || "-",
  };
}

function compactFile(file = {}) {
  if (typeof file === "string") {
    return file;
  }

  return {
    path: file.path || "-",
    layer: file.layer || "-",
    module: file.moduleKey || file.module || "-",
  };
}

function compactDependencies(dependencies = {}) {
  if (!dependencies || typeof dependencies !== "object") return {};

  return {
    dependenciesCount: dependencies.dependenciesCount ?? dependencies.count ?? undefined,
    packageDependencies: Array.isArray(dependencies.packageDependencies)
      ? dependencies.packageDependencies.slice(0, 40)
      : undefined,
    importsCount: dependencies.importsCount ?? undefined,
  };
}

function compactProjectMap(projectMap = {}, config = {}) {
  return {
    schemaVersion: projectMap.schemaVersion,
    repo: projectMap.repo,
    totals: projectMap.totals,
    layers: projectMap.layers,
    modules: compactArray(projectMap.modules, config.aiMaxModules, compactModule),
    moduleLinks: compactArray(projectMap.moduleLinks, config.aiMaxModuleLinks, compactModuleLink),
    entrypoints: compactArray(projectMap.entrypoints, 20, compactFile),
    criticalFiles: compactArray(projectMap.criticalFiles, config.aiMaxCriticalFiles, compactFile),
    commandLikeFiles: compactArray(projectMap.commandLikeFiles, config.aiMaxCommandLikeFiles, compactFile),
    dependencies: compactDependencies(projectMap.dependencies),
  };
}

function buildPrompt(projectMap = {}, config = {}) {
  return [
    {
      role: "system",
      content: [
        "You are RepoStateAgent AI Analyzer for SG / Советник GARYA.",
        "Analyze repository projectMap only.",
        "Do not invent files or modules.",
        "Return strict JSON only.",
        "JSON fields: moduleDescriptions, filePurposes, architectureProblems, recommendations, riskLevel.",
        "Keep output compact and practical.",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify(compactProjectMap(projectMap, config)),
    },
  ];
}

function measurePromptChars(messages = []) {
  return messages.reduce((sum, message) => sum + String(message?.content || "").length, 0);
}

function buildDryRunAnalysis({ promptChars, config }) {
  return {
    dryRun: true,
    promptChars,
    limits: {
      aiMaxPromptChars: config.aiMaxPromptChars,
      aiMaxModules: config.aiMaxModules,
      aiMaxModuleLinks: config.aiMaxModuleLinks,
      aiMaxCommandLikeFiles: config.aiMaxCommandLikeFiles,
      aiMaxCriticalFiles: config.aiMaxCriticalFiles,
      aiCostLevel: config.aiCostLevel,
    },
    summary: "AI analyzer dry-run completed. No tokens were spent.",
  };
}

export async function analyzeRepoStateProjectMap(projectMap = {}) {
  const config = getRepoStateAgentConfig();

  if (!config.aiEnabled) {
    return {
      enabled: false,
      skipped: true,
      reason: "repo_state_agent_ai_disabled",
    };
  }

  const messages = buildPrompt(projectMap, config);
  const promptChars = measurePromptChars(messages);

  if (promptChars > config.aiMaxPromptChars) {
    return {
      enabled: true,
      skipped: true,
      reason: "repo_state_agent_prompt_too_large",
      promptChars,
      maxPromptChars: config.aiMaxPromptChars,
    };
  }

  if (config.aiDryRun) {
    return {
      enabled: true,
      skipped: true,
      reason: "repo_state_agent_ai_dry_run",
      analysis: buildDryRunAnalysis({ promptChars, config }),
    };
  }

  const raw = await callAI(messages, config.aiCostLevel);

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      parseError: true,
      raw,
    };
  }

  return {
    enabled: true,
    skipped: false,
    promptChars,
    analysis: parsed,
  };
}

export default analyzeRepoStateProjectMap;
