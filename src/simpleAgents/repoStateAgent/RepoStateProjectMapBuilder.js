// src/simpleAgents/repoStateAgent/RepoStateProjectMapBuilder.js
// ============================================================================
// Repo State Project Map Builder
// Builds compact agent-readable project map from collector snapshot.
// ============================================================================

import { buildRepoStateSemanticMap } from "./RepoStateSemanticMapBuilder.js";

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

function pathIsOrStartsWith(normalizedPath, prefix) {
  const normalizedPrefix = String(prefix || "").toLowerCase().replace(/\/$/, "");
  return normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`);
}

function classifyLayer(path = "") {
  const normalized = String(path || "").toLowerCase().replace(/\/$/, "");

  if (normalized === "index.js" || normalized.endsWith("/index.js")) return "entrypoint";
  if (normalized === "ai.js") return "root_ai_adapter";
  if (normalized === "db.js") return "root_database_adapter";
  if (normalized === "modelconfig.js") return "root_model_config";
  if (normalized === "projectmemory.js") return "root_project_memory_adapter";
  if (normalized === "sources.js") return "root_sources_adapter";
  if (normalized === "systemprompt.js") return "root_prompt_config";
  if (normalized === "classifier.js") return "root_classifier_adapter";
  if (normalized === "package.json" || normalized === "package-lock.json") return "root_package_config";
  if (normalized === "readme.md" || normalized === "agents.md") return "root_docs";
  if (normalized === ".env.example") return "root_env_template";
  if (normalized === ".gitignore") return "root_git_config";
  if (pathIsOrStartsWith(normalized, "core")) return "legacy_core";
  if (pathIsOrStartsWith(normalized, "fix")) return "fix_artifacts";
  if (pathIsOrStartsWith(normalized, "syslog")) return "runtime_logs";
  if (pathIsOrStartsWith(normalized, "migrations")) return "database";
  if (pathIsOrStartsWith(normalized, "pillars")) return "pillars";
  if (pathIsOrStartsWith(normalized, "agent_workspace")) return "agent_workspace_reports";
  if (pathIsOrStartsWith(normalized, ".github")) return "devops";
  if (pathIsOrStartsWith(normalized, "scripts")) return "devops";
  if (pathIsOrStartsWith(normalized, "diagnostics")) return "diagnostics";
  if (pathIsOrStartsWith(normalized, "docs")) return "docs";
  if (pathIsOrStartsWith(normalized, "archive")) return "archive";

  if (pathIsOrStartsWith(normalized, "src/simpleagents")) return "simple_agents";
  if (pathIsOrStartsWith(normalized, "src/agentworkspace")) return "agent_workspace";
  if (pathIsOrStartsWith(normalized, "src/repostatecollector")) return "repo_state_collector";
  if (pathIsOrStartsWith(normalized, "src/core")) return "core";
  if (pathIsOrStartsWith(normalized, "src/bot") || pathIsOrStartsWith(normalized, "src/transport")) return "transport";
  if (pathIsOrStartsWith(normalized, "src/http")) return "http";
  if (pathIsOrStartsWith(normalized, "src/integrations")) return "integrations";
  if (pathIsOrStartsWith(normalized, "src/jobs")) return "jobs";
  if (pathIsOrStartsWith(normalized, "src/db")) return "database";
  if (pathIsOrStartsWith(normalized, "src/access")) return "access_control";
  if (pathIsOrStartsWith(normalized, "src/bootstrap")) return "bootstrap";
  if (pathIsOrStartsWith(normalized, "src/capabilities")) return "capabilities";
  if (pathIsOrStartsWith(normalized, "src/codeoutput")) return "code_output";
  if (pathIsOrStartsWith(normalized, "src/decision")) return "decision";
  if (pathIsOrStartsWith(normalized, "src/documents")) return "documents";
  if (pathIsOrStartsWith(normalized, "src/logging")) return "logging";
  if (pathIsOrStartsWith(normalized, "src/media")) return "media";
  if (pathIsOrStartsWith(normalized, "src/memory")) return "memory";
  if (pathIsOrStartsWith(normalized, "src/observability")) return "observability";
  if (pathIsOrStartsWith(normalized, "src/projectexperience")) return "project_experience";
  if (pathIsOrStartsWith(normalized, "src/projectmemory")) return "project_memory";
  if (pathIsOrStartsWith(normalized, "src/repo")) return "repository_access";
  if (pathIsOrStartsWith(normalized, "src/robot")) return "robot_layer";
  if (pathIsOrStartsWith(normalized, "src/services")) return "services";
  if (pathIsOrStartsWith(normalized, "src/sources")) return "sources";
  if (pathIsOrStartsWith(normalized, "src/tasks")) return "tasks";
  if (pathIsOrStartsWith(normalized, "src/users")) return "users";
  if (pathIsOrStartsWith(normalized, "src/vision")) return "vision";

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

function buildRootListing(files = []) {
  const directories = new Set();
  const rootFiles = [];

  for (const file of files) {
    const path = String(file?.path || "").trim();
    if (!path) continue;

    const parts = path.split("/").filter(Boolean);
    if (parts.length > 1) {
      directories.add(parts[0]);
      continue;
    }

    rootFiles.push({
      path,
      layer: classifyLayer(path),
      extension: file?.extension || null,
      size: file?.size || 0,
      contentLoaded: file?.contentLoaded === true,
    });
  }

  return {
    path: "/",
    directories: Array.from(directories).sort(),
    files: rootFiles.sort((a, b) => a.path.localeCompare(b.path)),
  };
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

  const projectMap = {
    schemaVersion: 7,
    generatedAt: new Date().toISOString(),
    repo: {
      fullName: snapshot?.repoFullName || null,
      branch: snapshot?.branch || null,
      refSha: snapshot?.refSha || snapshot?.tree?.refSha || null,
      headCommitSha: snapshot?.headCommitSha || snapshot?.tree?.headCommitSha || null,
      commitSha: snapshot?.commitSha || snapshot?.tree?.commitSha || snapshot?.tree?.headCommitSha || null,
      treeSha: snapshot?.treeSha || snapshot?.tree?.treeSha || null,
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
    rootListing: buildRootListing(files),
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
        "Use semanticMap.taskRoutingHints to choose target modules before reading many files.",
        "Do not edit pillars unless explicitly allowed by Monarch.",
      ],
    },
  };

  return {
    ...projectMap,
    semanticMap: buildRepoStateSemanticMap(projectMap),
  };
}

export default buildRepoStateProjectMap;
