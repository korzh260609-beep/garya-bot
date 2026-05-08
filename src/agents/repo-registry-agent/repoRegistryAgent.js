// AGENT NOTE:
// RepoRegistryAgent simple collector.
// Purpose: build a deterministic repository folder/file registry and write one latest JSON report.
// Do not add AI calls, code edits, deletes, deploys, or Telegram flow here.

import workspaceChannel from "../../runtime/workspace/workspaceChannel.js";
import { executeGitHubApiRequest } from "../../tools/github/githubApiClient.js";
import {
  getCurrentProjectBranch,
  getCurrentProjectRepository,
} from "../../tools/github/githubProjectDefaults.js";

const LATEST_REPO_REGISTRY_PATH = "runtime/repo/latest/latest-repo-registry.json";
const MAX_ITEMS = 5000;

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parentDir(path) {
  const text = normalizeString(path).replace(/\/+$/, "");
  const index = text.lastIndexOf("/");
  return index > 0 ? text.slice(0, index) : "";
}

function extensionOf(path) {
  const name = normalizeString(path).split("/").pop() || "";
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(index + 1).toLowerCase() : "";
}

function describePath(path, type) {
  const p = normalizeString(path);
  const ext = extensionOf(p);
  const name = p.split("/").pop() || p;

  if (type === "tree") {
    if (p === "src") return "Application source code.";
    if (p === "src/agents") return "SG agent layer.";
    if (p.startsWith("src/agents/")) return "Agent-specific folder.";
    if (p === "src/tools") return "Runtime tool layer.";
    if (p === "src/tasks") return "Task layer.";
    if (p === "src/integrations") return "External integration layer.";
    if (p === "src/runtime") return "Runtime workspace and runtime helpers.";
    if (p === "runtime") return "Generated runtime workspace reports.";
    if (p === "pillars") return "Project principles, architecture notes, and decisions.";
    if (p === "docs") return "Project documentation.";
    if (p === "scripts") return "Utility and smoke-test scripts.";
    return "Repository folder.";
  }

  if (name === "README.md") return "Folder documentation.";
  if (name === "package.json") return "Node.js package manifest.";
  if (name === "package-lock.json") return "Locked Node.js dependency tree.";
  if (name === "index.js") return "JavaScript entry point or public boundary.";
  if (ext === "js") return "JavaScript source file.";
  if (ext === "json") return "JSON data/configuration file.";
  if (ext === "md") return "Markdown documentation.";
  if (ext === "yml" || ext === "yaml") return "YAML configuration file.";
  if (ext === "env") return "Environment variable template.";
  return "Repository file.";
}

function statusForPath(path, type) {
  const p = normalizeString(path);
  if (p.startsWith("runtime/")) return "generated";
  if (p.includes("skeleton")) return "skeleton";
  if (p.endsWith("README.md") || p.startsWith("docs/") || p.startsWith("pillars/")) return "documentation";
  if (type === "tree") return "folder";
  return "active_or_config";
}

function normalizeTreeItems(tree = []) {
  return tree
    .filter((item) => item?.path && (item.type === "blob" || item.type === "tree"))
    .slice(0, MAX_ITEMS)
    .map((item) => {
      const path = normalizeString(item.path);
      const type = item.type === "tree" ? "folder" : "file";

      return {
        path,
        type,
        parent: parentDir(path),
        extension: type === "file" ? extensionOf(path) : "",
        description: describePath(path, item.type),
        status: statusForPath(path, item.type),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

async function getBranchHeadSha({ repo, branch }) {
  const result = await executeGitHubApiRequest({
    method: "GET",
    path: `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
  });

  if (!result.ok) {
    throw new Error(`repo_registry_ref_failed:${result.status}:${result.error || "unknown"}`);
  }

  return result.data?.object?.sha || "";
}

async function getRecursiveTree({ repo, sha }) {
  const result = await executeGitHubApiRequest({
    method: "GET",
    path: `/repos/${repo}/git/trees/${encodeURIComponent(sha)}`,
    query: { recursive: 1 },
  });

  if (!result.ok) {
    throw new Error(`repo_registry_tree_failed:${result.status}:${result.error || "unknown"}`);
  }

  return {
    truncated: Boolean(result.data?.truncated),
    tree: Array.isArray(result.data?.tree) ? result.data.tree : [],
  };
}

export async function collectRepoRegistry({ repo, branch } = {}) {
  const safeRepo = normalizeString(repo || getCurrentProjectRepository());
  const safeBranch = normalizeString(branch || getCurrentProjectBranch());

  if (!safeRepo) throw new Error("repo_registry_repo_missing");
  if (!safeBranch) throw new Error("repo_registry_branch_missing");

  const headSha = await getBranchHeadSha({ repo: safeRepo, branch: safeBranch });
  if (!headSha) throw new Error("repo_registry_head_sha_missing");

  const treeResult = await getRecursiveTree({ repo: safeRepo, sha: headSha });
  const items = normalizeTreeItems(treeResult.tree);

  return {
    ok: true,
    type: "repo_registry",
    generated_at: new Date().toISOString(),
    repo: safeRepo,
    branch: safeBranch,
    head_sha: headSha,
    truncated: treeResult.truncated,
    items_count: items.length,
    items,
  };
}

export async function runRepoRegistryAgent(input = {}) {
  const data = await collectRepoRegistry(input);
  const write = await workspaceChannel.writeJson(LATEST_REPO_REGISTRY_PATH, data, {
    message: `repo registry: update latest ${data.items_count || 0}`,
  });

  return {
    ok: true,
    type: "repo_registry_agent",
    path: LATEST_REPO_REGISTRY_PATH,
    items_count: data.items_count,
    repo: data.repo,
    branch: data.branch,
    head_sha: data.head_sha,
    truncated: data.truncated,
    write,
  };
}

export default {
  collectRepoRegistry,
  runRepoRegistryAgent,
};
