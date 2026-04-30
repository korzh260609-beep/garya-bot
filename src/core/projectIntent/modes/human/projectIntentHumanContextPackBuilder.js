// src/core/projectIntent/modes/human/projectIntentHumanContextPackBuilder.js
// ============================================================================
// HUMAN PROJECT CONTEXT PACK BUILDER — SKELETON
//
// Purpose:
// - build a structured context package for Human Mode project/repo answers.
// - keep repo facts, official architecture, project memory and user rules separated.
// - prepare Human Mode for source-first answers based on multiple verified layers.
//
// Hard rules:
// - no DB writes.
// - no AI calls.
// - no repo scans.
// - no keyword routing.
// - no final response generation here.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";
import { getPreferredPillarPath } from "../../../../projectExperience/PillarTargetResolver.js";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function buildActiveProjectSection(context = null) {
  const activeProjectContext = asObject(context?.activeProjectContext);

  return {
    available: activeProjectContext?.active === true,
    source: activeProjectContext?.source || null,
    projectKey: activeProjectContext?.projectKey || null,
    projectName: activeProjectContext?.projectName || null,
    repository: activeProjectContext?.repository || null,
    ref: activeProjectContext?.ref || null,
  };
}

function buildRepoFactsSection(repoFacts = null) {
  return {
    available: repoFacts?.ok === true,
    source: repoFacts?.source || null,
    repo: repoFacts?.facts?.repo || null,
    totals: repoFacts?.facts?.totals || null,
    layers: repoFacts?.facts?.layers || null,
    semanticMap: repoFacts?.facts?.semanticMap || null,
    architectureHealth: repoFacts?.facts?.architectureHealth || null,
    nextActionPlan: repoFacts?.facts?.nextActionPlan || null,
    aiMeta: repoFacts?.facts?.aiMeta || null,
  };
}

function buildOfficialArchitectureSection(context = null) {
  const officialArchitecture = asObject(context?.officialArchitecture);

  if (officialArchitecture) {
    return {
      available: true,
      source: officialArchitecture.source || "context.officialArchitecture",
      data: officialArchitecture,
    };
  }

  return {
    available: false,
    source: null,
    expectedSources: [
      "pillars/architecture/SG_INTERFACE_LAYERS.md",
      "pillars/architecture/REPO_MAP_SOURCE_POLICY.md",
      "pillars/architecture/SEMANTIC_ROUTING.md",
      "pillars/architecture/HUMAN_MODE_REPOSTATEAGENT_SKELETON.md",
    ],
    note: "Official architecture loading is not wired yet.",
  };
}

function buildProjectMemorySection(context = null) {
  const projectMemory = asObject(context?.projectMemory) || asObject(context?.projectMemoryContext);

  if (projectMemory) {
    return {
      available: true,
      source: projectMemory.source || "context.projectMemory",
      data: projectMemory,
    };
  }

  return {
    available: false,
    source: null,
    expectedSources: [
      "project memory tables/config",
      getPreferredPillarPath("workflow"),
      getPreferredPillarPath("decisions"),
      "agent_workspace reports",
    ],
    note: "Project memory loading is not wired yet.",
  };
}

function buildUserRulesSection(context = null) {
  const userRules = asObject(context?.userRules) || asObject(context?.longTermUserRules);

  return {
    available: true,
    source: userRules?.source || "human_project_context_pack_defaults",
    rules: {
      ...(userRules?.rules || userRules || {}),
      requirePermissionBeforeCodeChange: true,
      skeletonConfigLogic: true,
      sourceFirst: true,
      responseStyle: "short_step_by_step",
    },
  };
}

export function buildHumanProjectContextPack({
  context = null,
  repoFacts = null,
  meaning = null,
} = {}) {
  return {
    ok: true,
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    source: "human_project_context_pack_v1",
    activeProject: buildActiveProjectSection(context),
    meaning,
    repoFacts: buildRepoFactsSection(repoFacts),
    officialArchitecture: buildOfficialArchitectureSection(context),
    projectMemory: buildProjectMemorySection(context),
    userRules: buildUserRulesSection(context),
    policy: {
      keepSourcesSeparated: true,
      repoFactsAreCurrentCodeTruth: true,
      officialArchitectureIsDesignTruth: true,
      projectMemoryIsDecisionHistory: true,
      longTermMemoryIsUserWorkStyle: true,
      noSourceMaySilentlyOverrideAnother: true,
    },
  };
}

export default {
  buildHumanProjectContextPack,
};