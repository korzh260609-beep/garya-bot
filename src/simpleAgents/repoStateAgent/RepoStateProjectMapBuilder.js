// src/simpleAgents/repoStateAgent/RepoStateProjectMapBuilder.js
// ============================================================================
// Repo State Project Map Builder
// Builds compact agent-readable project map from collector snapshot.
// ============================================================================

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function pickTop(items, limit = 25) {
  return asArray(items).slice(0, limit);
}

function isCommandLikePath(path = "") {
  const lower = String(path || "").toLowerCase();
  return (
    lower.includes("command") ||
    lower.includes("commands") ||
    lower.includes("diag") ||
    lower.includes("route") ||
    lower.includes("handler") ||
    lower.endsWith("index.js")
  );
}

export function buildRepoStateProjectMap(snapshot = {}) {
  const files = asArray(snapshot?.tree?.files);
  const modules = asArray(snapshot?.modules);
  const dependencies = asArray(snapshot?.dependencies);

  const commandLikeFiles = files
    .filter((file) => isCommandLikePath(file?.path))
    .map((file) => ({
      path: file.path,
      moduleKey: file.moduleKey || null,
      extension: file.extension || null,
      size: file.size || 0,
    }));

  const entrypoints = files
    .filter((file) => ["index.js", "server.js", "app.js"].some((name) => String(file?.path || "").endsWith(name)))
    .map((file) => file.path);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    repo: {
      fullName: snapshot?.repoFullName || null,
      branch: snapshot?.branch || null,
    },
    totals: {
      files: snapshot?.filesCount || files.length,
      modules: snapshot?.modulesCount || modules.length,
      dependencies: snapshot?.dependenciesCount || dependencies.length,
      contentLoaded: snapshot?.tree?.contentFilesLoaded || 0,
      contentSkipped: snapshot?.tree?.contentFilesSkipped || 0,
      hiddenFiles: snapshot?.tree?.hiddenFilesCount || 0,
      structureComplete: snapshot?.tree?.structureComplete === true,
    },
    modules: modules.map((module) => ({
      key: module.moduleKey,
      name: module.moduleName || module.moduleKey,
      rootPath: module.rootPath || module.moduleKey,
      filesCount: module.filesCount || 0,
      totalSize: module.totalSize || 0,
      sampleFiles: pickTop(module.files || [], 20),
    })),
    entrypoints,
    commandLikeFiles: pickTop(commandLikeFiles, 100),
    dependencies: {
      internalCount: snapshot?.dependencyStats?.internalCount || 0,
      externalCount: snapshot?.dependencyStats?.externalCount || 0,
      unresolvedInternalCount: snapshot?.dependencyStats?.unresolvedInternalCount || 0,
      samples: pickTop(dependencies, 100),
    },
    purpose: "Agent-readable project map for Advisor, SG, Codex, and future simple agents.",
  };
}

export default buildRepoStateProjectMap;
