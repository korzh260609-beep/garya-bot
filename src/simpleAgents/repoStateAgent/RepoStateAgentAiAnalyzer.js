// src/simpleAgents/repoStateAgent/RepoStateAgentAiAnalyzer.js
// ============================================================================
// Repo State Agent AI Analyzer
// Optional AI layer over project map.
// ============================================================================

import { callAI } from "../../../ai.js";
import { getRepoStateAgentConfig } from "./RepoStateAgentConfig.js";

function compactProjectMap(projectMap = {}, config = {}) {
  return {
    schemaVersion: projectMap.schemaVersion,
    repo: projectMap.repo,
    totals: projectMap.totals,
    layers: projectMap.layers,
    modules: Array.isArray(projectMap.modules)
      ? projectMap.modules.slice(0, config.aiMaxModules)
      : [],
    moduleLinks: Array.isArray(projectMap.moduleLinks)
      ? projectMap.moduleLinks.slice(0, config.aiMaxModuleLinks)
      : [],
    entrypoints: projectMap.entrypoints || [],
    criticalFiles: Array.isArray(projectMap.criticalFiles)
      ? projectMap.criticalFiles.slice(0, config.aiMaxCriticalFiles)
      : [],
    commandLikeFiles: Array.isArray(projectMap.commandLikeFiles)
      ? projectMap.commandLikeFiles.slice(0, config.aiMaxCommandLikeFiles)
      : [],
    dependencies: projectMap.dependencies,
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
