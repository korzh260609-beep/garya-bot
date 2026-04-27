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

function classifyLayer(path = "") {
  const normalized = String(path || "").toLowerCase();

  if (normalized.startsWith("src/simpleagents/")) return "simple_agents";
  if (normalized.startsWith("src/agentworkspace/")) return "agent_workspace";
  if (normalized.startsWith("src/core/")) return "core";
  if (normalized.startsWith("src/bot/") || normalized.startsWith("src/transport/")) return "transport";
  if (normalized.startsWith("src/http/")) return "http";
  if (normalized.startsWith("src/integrations/")) return "integrations";
  if (normalized.startsWith("src/jobs/")) return "jobs";
  if (normalized.startsWith("src/db/") || normalized.startsWith("migrations/")) return "database";
  if (normalized.startsWith("src/repostatecollector/")) return "repo_state_collector";
  if (normalized.startsWith("pillars/")) return "pillars";
  if (normalized === "index.js" || normalized.endsWith("/index.js")) return "entrypoint";

  return "other";
}

function isCriticalFile(path = "") {
  const normalized = String(path || "");
  return [
    "index.js",
    "ai.js",
    "db.js",
    "projectMemory.js",
    "src/core/handleMessage.js",
    "src/core/coreDepsFactory.js",
    "src/bootstrap/initSystem.js",
    "src/http/server.js",
    "src/transport/telegramAdapter.js",
  ].includes(normalized) || normalized.startsWith("pillars/");
}

function moduleKeyForPath(path = "") {
  const parts = String(path || "").split("/").filter(Boolean);
  if (!parts.length) return "root";
  if (parts[0] === "src" && parts[1]) return `src/${parts[1]}`;
  return parts[0];
}

function buildLayerSummary(files = []) {
  const summary = {};

  for (const file of files) {
    const layer = classifyLayer(file?.path);
    if (!summary[layer]) {
      summary[layer] = { filesCount: 0, totalSize: 0, sampleFiles: [] };
    }

    summary[layer].filesCount += 1;
    summary[layer].totalSize += Number(file?.size || 0);

    if (summary[layer].sampleFiles.length < 15) {
      summary[layer].sampleFiles.push(file.path);
    }
  }

  return summary;
}

function buildModuleLinks(dependencies = []) {
  const linkMap = new Map();

  for (const dependency of dependencies) {
    const sourceModule = moduleKeyForPath(dependency?.sourceFile || "");
    const targetModule = dependency?.targetFile
      ? moduleKeyForPath(dependency.targetFile)
      : dependency?.dependencyType === "external"
        ? "external"
        : "unresolved";

    const key = `${sourceModule}→${targetModule}`;
    const current = linkMap.get(key) || {
      sourceModule,
      targetModule,
      count: 0,
      samples: [],
    };

    current.count += 1;
    if (current.samples.length < 10) {
      current.samples.push({
        sourceFile: dependency?.sourceFile || null,
        targetSpecifier: dependency?.targetSpecifier || null,
        targetFile: dependency?.targetFile || null,
        dependencyType: dependency?.dependencyType || null,
      });
    }

    linkMap.set(key, current);
  }

  return Array.from(linkMap.values()).sort((a, b) => b.count - a.count);
}

export function buildRepoStateProjectMap(snapshot = {}) {
  const files = asArray(snapshot?.tree?.files);
  const modules = asArray(snapshot?.modules);
  const dependencies = asArray(snapshot?.dependencies);

  const commandLikeFiles = files
    .filter((file) => isCommandLikePath(file?.path))
    .map((file) => ({
      path: file.path,
      moduleKey: file.moduleKey || moduleKeyForPath(file.path),
      layer: classifyLayer(file.path),
      extension: file.extension || null,
      size: file.size || 0,
    }));

  const entrypoints = files
    .filter((file) => ["index.js", "server.js", "app.js"].some((name) => String(file?.path || "").endsWith(name)))
    .map((file) => ({ path: file.path, layer: classifyLayer(file.path) }));

  const criticalFiles = files
    .filter((file) => isCriticalFile(file?.path))
    .map((file) => ({
      path: file.path,
      layer: classifyLayer(file.path),
      size: file.size || 0,
      contentLoaded: file.contentLoaded === true,
    }));

  const moduleLinks = buildModuleLinks(dependencies);

  return {
    schemaVersion: 2,
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
    layers: buildLayerSummary(files),
    modules: modules.map((module) => ({
      key: module.moduleKey,
      name: module.moduleName || module.moduleKey,
      rootPath: module.rootPath || module.moduleKey,
      layer: classifyLayer(module.rootPath || module.moduleKey),
      filesCount: module.filesCount || 0,
      totalSize: module.totalSize || 0,
      sampleFiles: pickTop(module.files || [], 20),
    })),
    moduleLinks: pickTop(moduleLinks, 100),
    entrypoints,
    criticalFiles,
    commandLikeFiles: pickTop(commandLikeFiles, 100),
    dependencies: {
      internalCount: snapshot?.dependencyStats?.internalCount || 0,
      externalCount: snapshot?.dependencyStats?.externalCount || 0,
      unresolvedInternalCount: snapshot?.dependencyStats?.unresolvedInternalCount || 0,
      samples: pickTop(dependencies, 100),
    },
    agentBrief: {
      purpose: "Agent-readable project map for Advisor, SG, Codex, and future simple agents.",
      howToUse: [
        "Read entrypoints first.",
        "Use layers to understand responsibility boundaries.",
        "Use modules and moduleLinks before editing code.",
        "Check criticalFiles before architectural changes.",
        "Do not edit pillars unless explicitly allowed by Monarch.",
      ],
    },
  };
}

export default buildRepoStateProjectMap;
