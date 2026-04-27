// src/simpleAgents/repoStateAgent/RepoStateAgentChangeDetector.js
// ============================================================================
// Repo State Agent Change Detector
// Decides whether AI analysis is needed.
// ============================================================================

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortDeep(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function stableStringify(value) {
  return JSON.stringify(sortDeep(value || {}));
}

function buildMapSignature(projectMap = {}) {
  return stableStringify({
    schemaVersion: projectMap.schemaVersion,
    totals: projectMap.totals,
    modules: projectMap.modules,
    moduleLinks: projectMap.moduleLinks,
    entrypoints: projectMap.entrypoints,
    criticalFiles: projectMap.criticalFiles,
    commandLikeFiles: projectMap.commandLikeFiles,
  });
}

export function detectRepoStateAiNeed({ projectMap, previousAiState } = {}) {
  const currentSignature = buildMapSignature(projectMap);
  const previousSignature = previousAiState?.projectMapSignature || "";

  if (!previousAiState) {
    return {
      shouldAnalyze: true,
      reason: "first_analysis",
      projectMapSignature: currentSignature,
    };
  }

  if (currentSignature !== previousSignature) {
    return {
      shouldAnalyze: true,
      reason: "project_map_changed",
      projectMapSignature: currentSignature,
    };
  }

  return {
    shouldAnalyze: false,
    reason: "project_map_unchanged",
    projectMapSignature: currentSignature,
  };
}

export default detectRepoStateAiNeed;
