// AGENT NOTE:
// RepoStateAgent project map builder skeleton.
// Purpose: build a compact read-only project map from already-provided repo facts.
// Do not read GitHub, call AI, write DB, write files, or access runtime state here.

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(path) {
  return String(path || "").trim().replace(/^\.\//, "");
}

function moduleKeyForPath(path = "") {
  const normalized = normalizePath(path);
  const parts = normalized.split("/").filter(Boolean);

  if (!parts.length) return "root";
  if (parts[0] === "src" && parts[1]) return `src/${parts[1]}`;
  return parts[0];
}

function pathIsOrStartsWith(path, prefix) {
  const normalized = normalizePath(path).toLowerCase();
  const normalizedPrefix = normalizePath(prefix).toLowerCase().replace(/\/$/, "");
  return normalized === normalizedPrefix || normalized.startsWith(`${normalizedPrefix}/`);
}

function classifyLayer(path = "") {
  const normalized = normalizePath(path).toLowerCase();

  if (!normalized) return "unknown";
  if (normalized === "index.js" || normalized.endsWith("/index.js")) return "entrypoint";
  if (normalized === "package.json" || normalized === "package-lock.json") return "package_config";
  if (normalized === ".env.example") return "env_contract";
  if (pathIsOrStartsWith(normalized, "pillars")) return "pillars";
  if (pathIsOrStartsWith(normalized, "docs")) return "docs";
  if (pathIsOrStartsWith(normalized, "scripts")) return "devops";
  if (pathIsOrStartsWith(normalized, ".github")) return "devops";
  if (pathIsOrStartsWith(normalized, "src/config")) return "config";
  if (pathIsOrStartsWith(normalized, "src/core")) return "core";
  if (pathIsOrStartsWith(normalized, "src/transport")) return "transport";
  if (pathIsOrStartsWith(normalized, "src/delivery")) return "delivery";
  if (pathIsOrStartsWith(normalized, "src/ai")) return "ai";
  if (pathIsOrStartsWith(normalized, "src/users")) return "users";
  if (pathIsOrStartsWith(normalized, "src/permissions")) return "permissions";
  if (pathIsOrStartsWith(normalized, "src/agents/repo-intelligence")) return "repo_intelligence_agents";
  if (pathIsOrStartsWith(normalized, "src/agents/repo-maintenance")) return "repo_maintenance_agents";
  if (pathIsOrStartsWith(normalized, "src/agents/shared")) return "agent_shared";
  if (pathIsOrStartsWith(normalized, "src/agents")) return "agents";

  return "other";
}

function filePathFromItem(item) {
  if (typeof item === "string") return normalizePath(item);
  return normalizePath(item?.path || item?.filename || "");
}

function buildLayerSummary(files = []) {
  const summary = {};

  for (const item of asArray(files)) {
    const path = filePathFromItem(item);
    if (!path) continue;

    const layer = classifyLayer(path);
    if (!summary[layer]) {
      summary[layer] = {
        filesCount: 0,
        sampleFiles: [],
      };
    }

    summary[layer].filesCount += 1;

    if (summary[layer].sampleFiles.length < 20) {
      summary[layer].sampleFiles.push(path);
    }
  }

  return summary;
}

function buildModuleSummary(files = []) {
  const modules = new Map();

  for (const item of asArray(files)) {
    const path = filePathFromItem(item);
    if (!path) continue;

    const key = moduleKeyForPath(path);
    const current = modules.get(key) || {
      key,
      layer: classifyLayer(path),
      filesCount: 0,
      sampleFiles: [],
    };

    current.filesCount += 1;

    if (current.sampleFiles.length < 20) {
      current.sampleFiles.push(path);
    }

    modules.set(key, current);
  }

  return Array.from(modules.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function buildRootListing(files = []) {
  const directories = new Set();
  const rootFiles = [];

  for (const item of asArray(files)) {
    const path = filePathFromItem(item);
    if (!path) continue;

    const parts = path.split("/").filter(Boolean);
    if (parts.length > 1) {
      directories.add(parts[0]);
    } else {
      rootFiles.push(path);
    }
  }

  return {
    directories: Array.from(directories).sort(),
    files: rootFiles.sort(),
  };
}

function buildCriticalFiles(files = []) {
  const criticalPaths = new Set([
    "index.js",
    "package.json",
    ".env.example",
    "src/config/env.js",
    "src/core/handleMessage.js",
    "src/core/sgSystemPrompt.js",
    "src/ai/callAI.js",
    "src/ai/modelConfig.js",
    "src/permissions/monarchGate.js",
  ]);

  return asArray(files)
    .map(filePathFromItem)
    .filter(Boolean)
    .filter((path) => criticalPaths.has(path) || path.startsWith("pillars/"))
    .map((path) => ({
      path,
      layer: classifyLayer(path),
    }));
}

export function buildRepoStateProjectMap(input = {}) {
  const files = asArray(input.files || input.tree?.files);
  const dependencies = asArray(input.dependencies);

  return {
    schemaVersion: 1,
    generatedBy: "repo_state_project_map_builder_v1",
    tokensSpent: false,
    canChangeState: false,
    repo: {
      fullName: input.repoFullName || input.repo?.fullName || null,
      branch: input.branch || input.repo?.branch || null,
      commitSha: input.commitSha || input.repo?.commitSha || null,
    },
    totals: {
      files: files.length,
      dependencies: dependencies.length,
      modules: buildModuleSummary(files).length,
    },
    rootListing: buildRootListing(files),
    layers: buildLayerSummary(files),
    modules: buildModuleSummary(files),
    criticalFiles: buildCriticalFiles(files),
    dependencies: {
      count: dependencies.length,
      samples: dependencies.slice(0, 50),
    },
  };
}

export default buildRepoStateProjectMap;
