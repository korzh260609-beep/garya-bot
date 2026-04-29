// src/core/projectIntent/modes/human/projectIntentHumanRepoFacts.js
// ============================================================================
// HUMAN MODE REPO FACTS SKELETON
//
// Purpose:
// - RepoStateAgent-backed factual layer boundary for Human Mode repo/project work.
// - must not use old RepoIndex, old hardcoded maps, or old snapshot outputs as
//   current factual truth.
// - must not import Technical Mode legacy routing.
//
// Current status:
// - safe contract only.
// - not wired into runtime.
// - does not call RepoStateAgent by itself.
// - can use an explicitly injected runner only when explicitly allowed.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";

export const HUMAN_REPO_FACTS_SOURCES = Object.freeze({
  REPO_STATE_AGENT: "RepoStateAgent",
  NONE: "none",
});

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeRepoStateAgentFacts(repoStateAgentResult) {
  const result = asObject(repoStateAgentResult);

  if (!result) {
    return null;
  }

  const projectMap = asObject(result.projectMap);
  const architectureHealth = asObject(result.architectureHealth);
  const nextActionPlan = asObject(result.nextActionPlan);

  return {
    repo: projectMap?.repo || {
      fullName: result.repoFullName || null,
      branch: result.branch || null,
    },
    totals: projectMap?.totals || {
      files: result.filesCount || 0,
      modules: result.modulesCount || 0,
      dependencies: result.dependenciesCount || 0,
    },
    layers: projectMap?.layers || null,
    semanticMap: projectMap?.semanticMap || null,
    architectureHealth: architectureHealth || null,
    nextActionPlan: nextActionPlan || null,
    aiAnalysis: result.aiAnalysis || null,
    aiMeta: result.aiMeta || null,
  };
}

export function buildHumanProjectRepoFactsFromRepoStateAgentResult(repoStateAgentResult) {
  const facts = normalizeRepoStateAgentFacts(repoStateAgentResult);

  if (!facts) {
    return {
      mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
      ok: false,
      source: HUMAN_REPO_FACTS_SOURCES.REPO_STATE_AGENT,
      facts: null,
      reason: "repo_state_agent_result_missing_or_invalid",
    };
  }

  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    ok: true,
    source: HUMAN_REPO_FACTS_SOURCES.REPO_STATE_AGENT,
    facts,
    reason: "repo_state_agent_facts_loaded",
  };
}

async function runInjectedRepoStateAgent({ context = null } = {}) {
  const runner = context?.repoStateAgentRunner;

  if (typeof runner !== "function") {
    return null;
  }

  if (context?.allowHumanRepoStateAgentRun !== true) {
    return {
      mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
      ok: false,
      source: HUMAN_REPO_FACTS_SOURCES.REPO_STATE_AGENT,
      facts: null,
      reason: "repo_state_agent_runner_present_but_not_allowed",
    };
  }

  const result = await runner({
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    source: HUMAN_REPO_FACTS_SOURCES.REPO_STATE_AGENT,
  });

  return buildHumanProjectRepoFactsFromRepoStateAgentResult(result);
}

export async function loadHumanProjectRepoFacts({ context = null } = {}) {
  const repoStateAgentResult = context?.repoStateAgentResult || null;

  if (repoStateAgentResult) {
    return buildHumanProjectRepoFactsFromRepoStateAgentResult(repoStateAgentResult);
  }

  const injectedRunnerResult = await runInjectedRepoStateAgent({ context });

  if (injectedRunnerResult) {
    return injectedRunnerResult;
  }

  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    ok: false,
    source: HUMAN_REPO_FACTS_SOURCES.REPO_STATE_AGENT,
    facts: null,
    reason: "repo_state_agent_result_not_provided",
  };
}

export default {
  HUMAN_REPO_FACTS_SOURCES,
  buildHumanProjectRepoFactsFromRepoStateAgentResult,
  loadHumanProjectRepoFacts,
};
