// src/repoStateCollector/RepoTreeReader.js
// ============================================================================
// Repo Tree Reader
// Reads repository structure (read-only).
// ============================================================================

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePath(value) {
  return normalizeString(value).replace(/^\/+/, "");
}

function matchesAnyPrefix(path, patterns = []) {
  const normalizedPath = normalizePath(path);
  return patterns.some((pattern) => {
    const normalizedPattern = normalizePath(pattern);
    return normalizedPattern && normalizedPath.startsWith(normalizedPattern);
  });
}

function isExcluded(path, excludePatterns = []) {
  const normalizedPath = normalizePath(path);
  return excludePatterns.some((pattern) => {
    const normalizedPattern = normalizePath(pattern);
    return normalizedPattern && (
      normalizedPath === normalizedPattern ||
      normalizedPath.startsWith(`${normalizedPattern}/`) ||
      normalizedPath.includes(`/${normalizedPattern}/`)
    );
  });
}

export class RepoTreeReader {
  constructor({ githubClient, config } = {}) {
    this.githubClient = githubClient;
    this.config = config || {};
  }

  async readTree() {
    if (!this.githubClient || typeof this.githubClient.readTree !== "function") {
      return {
        ok: false,
        files: [],
        error: "repo_tree_reader_missing_github_client_readTree",
      };
    }

    const repoFullName = normalizeString(this.config.repoFullName || "");
    const branch = normalizeString(this.config.branch || "main") || "main";
    const includePatterns = Array.isArray(this.config.includePatterns) ? this.config.includePatterns : [];
    const excludePatterns = Array.isArray(this.config.excludePatterns) ? this.config.excludePatterns : [];
    const maxFiles = Number.isFinite(Number(this.config.maxFiles)) ? Number(this.config.maxFiles) : 5000;

    const tree = await this.githubClient.readTree({
      repoFullName,
      branch,
      recursive: true,
    });

    const rawFiles = Array.isArray(tree?.files)
      ? tree.files
      : Array.isArray(tree?.tree)
        ? tree.tree.filter((item) => item?.type === "blob")
        : [];

    const files = rawFiles
      .map((item) => ({
        path: normalizePath(item.path),
        sha: item.sha || null,
        size: Number.isFinite(Number(item.size)) ? Number(item.size) : null,
        type: item.type || "blob",
      }))
      .filter((item) => item.path)
      .filter((item) => includePatterns.length === 0 || matchesAnyPrefix(item.path, includePatterns))
      .filter((item) => !isExcluded(item.path, excludePatterns))
      .slice(0, maxFiles);

    return {
      ok: true,
      repoFullName,
      branch,
      files,
      filesCount: files.length,
      truncated: rawFiles.length > files.length && files.length >= maxFiles,
    };
  }
}

export default RepoTreeReader;
