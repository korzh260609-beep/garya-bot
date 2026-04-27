// src/repoStateCollector/RepoDependencyScanner.js
// ============================================================================
// Repo Dependency Scanner
// Detects static dependencies between files (imports/exports/requires).
// ============================================================================

function normalizePath(value) {
  return typeof value === "string" ? value.trim().replace(/^\/+/, "") : "";
}

function isRelativeSpecifier(value) {
  return typeof value === "string" && (value.startsWith("./") || value.startsWith("../"));
}

function dirname(path) {
  const normalized = normalizePath(path);
  const parts = normalized.split("/");
  parts.pop();
  return parts.join("/");
}

function normalizeSegments(path) {
  const parts = normalizePath(path).split("/").filter(Boolean);
  const output = [];

  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      output.pop();
      continue;
    }
    output.push(part);
  }

  return output.join("/");
}

function resolveRelativeImport(sourcePath, specifier, filePathSet) {
  if (!isRelativeSpecifier(specifier)) return null;

  const baseDir = dirname(sourcePath);
  const rawTarget = normalizeSegments(`${baseDir}/${specifier}`);
  const candidates = [
    rawTarget,
    `${rawTarget}.js`,
    `${rawTarget}.mjs`,
    `${rawTarget}.cjs`,
    `${rawTarget}.json`,
    `${rawTarget}/index.js`,
    `${rawTarget}/index.mjs`,
    `${rawTarget}/index.cjs`,
  ];

  return candidates.find((candidate) => filePathSet.has(candidate)) || rawTarget;
}

function extractSpecifiers(content = "") {
  const text = String(content || "");
  const specifiers = [];
  const patterns = [
    /import\s+(?:[^'";]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /export\s+[^'";]+\s+from\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(text);
    while (match) {
      if (match[1]) specifiers.push(match[1]);
      match = pattern.exec(text);
    }
  }

  return Array.from(new Set(specifiers));
}

export class RepoDependencyScanner {
  scanDependencies(files = []) {
    const normalizedFiles = (Array.isArray(files) ? files : [])
      .map((file) => ({
        path: normalizePath(file?.path || file),
        content: typeof file?.content === "string" ? file.content : "",
      }))
      .filter((file) => file.path);

    const filePathSet = new Set(normalizedFiles.map((file) => file.path));
    const dependencies = [];

    for (const file of normalizedFiles) {
      if (!file.content) continue;

      const specifiers = extractSpecifiers(file.content);
      for (const specifier of specifiers) {
        const internal = isRelativeSpecifier(specifier);
        const resolvedPath = internal
          ? resolveRelativeImport(file.path, specifier, filePathSet)
          : null;

        dependencies.push({
          sourceFile: file.path,
          targetSpecifier: specifier,
          targetFile: resolvedPath,
          dependencyType: internal ? "internal" : "external",
          resolved: Boolean(resolvedPath && filePathSet.has(resolvedPath)),
        });
      }
    }

    return {
      ok: true,
      dependencies,
      dependenciesCount: dependencies.length,
      internalCount: dependencies.filter((item) => item.dependencyType === "internal").length,
      externalCount: dependencies.filter((item) => item.dependencyType === "external").length,
      unresolvedInternalCount: dependencies.filter((item) => item.dependencyType === "internal" && !item.resolved).length,
    };
  }
}

export default RepoDependencyScanner;
