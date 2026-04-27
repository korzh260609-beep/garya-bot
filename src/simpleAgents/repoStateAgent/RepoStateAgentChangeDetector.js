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

function compareByStableKey(a, b) {
  return stableStringify(a).localeCompare(stableStringify(b));
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

function normalizeFileItem(item = {}) {
  return {
    path: getItemPath(item),
    moduleKey: getModuleKey(item),
    layer: normalizeString(item?.layer || ""),
    extension: normalizeString(item?.extension || item?.ext || ""),
  };
}

function normalizeModuleItem(item = {}) {
  return {
    moduleKey: getModuleKey(item),
    layer: normalizeString(item?.layer || ""),
  };
}

function normalizeModuleLink(link = {}) {
  return {
    from: normalizeString(link?.from || link?.fromModule || link?.source || ""),
    to: normalizeString(link?.to || link?.toModule || link?.target || ""),
    type: normalizeString(link?.type || link?.relation || ""),
  };
}

function stableFiles(files) {
  return Array.isArray(files)
    ? files
        .filter((item) => !isAgentLayerItem(item))
        .map(normalizeFileItem)
        .sort(compareByStableKey)
    : [];
}

function stableModules(modules) {
  return Array.isArray(modules)
    ? modules
        .filter((item) => !isAgentLayerItem(item))
        .map(normalizeModuleItem)
        .sort(compareByStableKey)
    : [];
}

function stableModuleLinks(moduleLinks) {
  return Array.isArray(moduleLinks)
    ? moduleLinks
        .map(normalizeModuleLink)
        .filter((link) => {
          return !isAgentLayerPath(link.from) &&
            !isAgentLayerPath(link.to) &&
            link.from !== "agent_workspace" &&
            link.to !== "agent_workspace" &&
            link.from !== "src/agentWorkspace" &&
            link.to !== "src/agentWorkspace" &&
            link.from !== "src/simpleAgents" &&
            link.to !== "src/simpleAgents" &&
            !link.from.startsWith("src/simpleAgents/") &&
            !link.to.startsWith("src/simpleAgents/");
        })
        .sort(compareByStableKey)
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
