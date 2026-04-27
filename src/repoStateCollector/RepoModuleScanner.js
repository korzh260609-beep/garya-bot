// src/repoStateCollector/RepoModuleScanner.js
// ============================================================================
// Repo Module Scanner
// Groups files into logical modules.
// ============================================================================

function normalizePath(value) {
  return typeof value === "string" ? value.trim().replace(/^\/+/, "") : "";
}

function toModuleKey(path) {
  const normalized = normalizePath(path);
  const parts = normalized.split("/").filter(Boolean);

  if (parts[0] !== "src") {
    return parts[0] || "root";
  }

  if (!parts[1]) {
    return "src";
  }

  if (parts[1] === "integrations" && parts[2]) {
    return `src/integrations/${parts[2]}`;
  }

  if (parts[1] === "bot" && parts[2]) {
    return `src/bot/${parts[2]}`;
  }

  return `src/${parts[1]}`;
}

function toModuleName(moduleKey) {
  return normalizePath(moduleKey)
    .split("/")
    .filter(Boolean)
    .map((part) => part
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase()))
    .join(" / ");
}

export class RepoModuleScanner {
  scanModules(files = []) {
    const moduleMap = new Map();

    for (const file of Array.isArray(files) ? files : []) {
      const path = normalizePath(file?.path || file);
      if (!path) continue;

      const moduleKey = toModuleKey(path);
      const current = moduleMap.get(moduleKey) || {
        moduleKey,
        moduleName: toModuleName(moduleKey),
        rootPath: moduleKey,
        files: [],
        filesCount: 0,
        totalSize: 0,
      };

      const size = Number.isFinite(Number(file?.size)) ? Number(file.size) : 0;
      current.files.push({
        path,
        sha: file?.sha || null,
        size,
      });
      current.filesCount += 1;
      current.totalSize += size;
      moduleMap.set(moduleKey, current);
    }

    const modules = Array.from(moduleMap.values())
      .map((module) => ({
        ...module,
        files: module.files.sort((a, b) => a.path.localeCompare(b.path)),
      }))
      .sort((a, b) => a.moduleKey.localeCompare(b.moduleKey));

    return {
      ok: true,
      modules,
      modulesCount: modules.length,
      filesCount: modules.reduce((sum, module) => sum + module.filesCount, 0),
    };
  }
}

export default RepoModuleScanner;
