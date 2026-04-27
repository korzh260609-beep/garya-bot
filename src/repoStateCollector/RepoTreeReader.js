// src/repoStateCollector/RepoTreeReader.js
// ============================================================================
// Repo Tree Reader
// Reads repository structure and bounded text file content (read-only).
// ============================================================================

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePath(value) {
  return normalizeString(value).replace(/^\/+/, "");
}

function getExtension(path) {
  const normalized = normalizePath(path);
  const last = normalized.split("/").pop() || "";
  const dotIndex = last.lastIndexOf(".");
  return dotIndex >= 0 ? last.slice(dotIndex).toLowerCase() : "";
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

async function readFileContent({ githubClient, repoFullName, branch, file }) {
  if (!githubClient || typeof githubClient.readFile !== "function") {
    return {
      ...file,
      content: "",
      contentLoaded: false,
      contentError: "repo_tree_reader_missing_github_client_readFile",
    };
  }

  try {
    const result = await githubClient.readFile({
      repoFullName,
      branch,
      path: file.path,
    });

    return {
      ...file,
      content: typeof result?.content === "string" ? result.content : "",
      contentLoaded: true,
      contentError: null,
    };
  } catch (error) {
    return {
      ...file,
      content: "",
      contentLoaded: false,
      contentError: error?.message || "repo_tree_reader_file_content_read_failed",
    };
  }
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
    const contentExtensions = Array.isArray(this.config.contentExtensions) ? this.config.contentExtensions : [];
    const maxFiles = Number.isFinite(Number(this.config.maxFiles)) ? Number(this.config.maxFiles) : 5000;
    const maxFileSize = Number.isFinite(Number(this.config.maxFileSize)) ? Number(this.config.maxFileSize) : 200_000;
    const maxContentFiles = Number.isFinite(Number(this.config.maxContentFiles)) ? Number(this.config.maxContentFiles) : 500;
    const readContent = this.config.readContent === true;

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

    let files = rawFiles
      .map((item) => ({
        path: normalizePath(item.path),
        sha: item.sha || null,
        size: Number.isFinite(Number(item.size)) ? Number(item.size) : null,
        type: item.type || "blob",
        extension: getExtension(item.path),
        content: "",
        contentLoaded: false,
        contentSkipped: true,
        contentSkipReason: "content_read_disabled",
      }))
      .filter((item) => item.path)
      .filter((item) => includePatterns.length === 0 || matchesAnyPrefix(item.path, includePatterns))
      .filter((item) => !isExcluded(item.path, excludePatterns))
      .slice(0, maxFiles);

    if (readContent) {
      let loaded = 0;
      const withContent = [];

      for (const file of files) {
        const size = Number.isFinite(Number(file.size)) ? Number(file.size) : 0;
        const extensionAllowed = contentExtensions.length === 0 || contentExtensions.includes(file.extension);
        const sizeAllowed = size <= maxFileSize;
        const countAllowed = loaded < maxContentFiles;

        if (!extensionAllowed || !sizeAllowed || !countAllowed) {
          withContent.push({
            ...file,
            contentSkipped: true,
            contentSkipReason: !extensionAllowed
              ? "extension_not_allowed"
              : !sizeAllowed
                ? "file_too_large"
                : "max_content_files_reached",
          });
          continue;
        }

        const loadedFile = await readFileContent({
          githubClient: this.githubClient,
          repoFullName,
          branch,
          file,
        });

        withContent.push({
          ...loadedFile,
          contentSkipped: !loadedFile.contentLoaded,
          contentSkipReason: loadedFile.contentLoaded ? null : loadedFile.contentError,
        });

        if (loadedFile.contentLoaded) loaded += 1;
      }

      files = withContent;
    }

    return {
      ok: true,
      repoFullName,
      branch,
      files,
      filesCount: files.length,
      contentFilesLoaded: files.filter((item) => item.contentLoaded).length,
      contentFilesSkipped: files.filter((item) => item.contentSkipped).length,
      truncated: rawFiles.length > files.length && files.length >= maxFiles,
    };
  }
}

export default RepoTreeReader;
