// src/simpleAgents/repoStateAgent/RepoStateAgentAiAnalyzer.js
// ============================================================================
// Repo State Agent AI Analyzer
// Optional AI layer over project map.
// ============================================================================

import { callAI } from "../../../ai.js";
import { getRepoStateAgentConfig } from "./RepoStateAgentConfig.js";

function compactProjectMap(projectMap = {}) {
  return {
    schemaVersion: projectMap.schemaVersion,
    repo: projectMap.repo,
    totals: projectMap.totals,
    layers: projectMap.layers,
    modules: Array.isArray(projectMap.modules) ? projectMap.modules.slice(0, 80) : [],
    moduleLinks: Array.isArray(projectMap.moduleLinks) ? projectMap.moduleLinks.slice(0, 80) : [],
    entrypoints: projectMap.entrypoints || [],
    criticalFiles: projectMap.criticalFiles || [],
    commandLikeFiles: Array.isArray(projectMap.commandLikeFiles) ? projectMap.commandLikeFiles.slice(0, 80) : [],
    dependencies: projectMap.dependencies,
  };
}

function buildPrompt(projectMap = {}) {
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
      content: JSON.stringify(compactProjectMap(projectMap)),
    },
  ];
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

  const messages = buildPrompt(projectMap);
  const raw = await callAI(messages, "high");

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
    analysis: parsed,
  };
}

export default analyzeRepoStateProjectMap;
