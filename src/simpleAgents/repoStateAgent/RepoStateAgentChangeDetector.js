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

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isAgentLayerPath(path) {
  const normalized = normalizeString(path);

  return normalized.startsWith("agent_workspace/") ||
    normalized.startsWith("src/agentWorkspace/") ||
    normalized.startsWith("src/simpleAgents/");
}

function getItemPath(item = {}) {
  return normalizeString(item?.path || item?.filePath || item?.sourcePath || "");
}

function getModuleKey(item = {}) {
  return normalizeString(item?.moduleKey || item?.key || item?.name || item?.id || "");
}

function isAgentLayerItem(item = {}) {
  const path = getItemPath(item);
  const moduleKey = getModuleKey(item);

  return isAgentLayerPath(path) ||
    moduleKey === "agent_workspace" ||
    moduleKey === "src/agentWorkspace" ||
    moduleKey === "src/simpleAgents" ||
    moduleKey.startsWith("src/simpleAgents/");
}

function stableFiles(files) {
  return Array.isArray(files)
    ? files.filter((item) => !isAgentLayerItem(item))
    : [];
}

function stableModules(modules) {
  return Array.isArray(modules)
    ? modules.filter((item) => !isAgentLayerItem(item))
    : [];
}

function stableModuleLinks(moduleLinks) {
  return Array.isArray(moduleLinks)
    ? moduleLinks.filter((link) => {
        const from = normalizeString(link?.from || link?.fromModule || link?.source || "");
        const to = normalizeString(link?.to || link?.toModule || link?.target || "");

        return !isAgentLayerPath(from) &&
          !isAgentLayerPath(to) &&
          from !== "agent_workspace" &&
          to !== "agent_workspace" &&
          from !== "src/agentWorkspace" &&
          to !== "src/agentWorkspace" &&
          from !== "src/simpleAgents" &&
          to !== "src/simpleAgents" &&
          !from.startsWith("src/simpleAgents/") &&
          !to.startsWith("src/simpleAgents/");
      })
    : [];
}

function buildMapSignature(projectMap = {}) {
  return stableStringify({
    schemaVersion: projectMap.schemaVersion,
    modules: stableModules(projectMap.modules),
    moduleLinks: stableModuleLinks(projectMap.moduleLinks),
    entrypoints: stableFiles(projectMap.entrypoints),
    criticalFiles: stableFiles(projectMap.criticalFiles),
    commandLikeFiles: stableFiles(projectMap.commandLikeFiles),
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
