// AGENT NOTE:
// RepoRegistryAgent deterministic collector.
// Purpose: build a repository folder/file registry with semantic metadata and write one latest JSON report.
// Do not add AI calls, code edits, deletes, deploys, or Telegram flow here.
// This agent must stay source-first, deterministic, and cheap to run.

import workspaceChannel from "../../runtime/workspace/workspaceChannel.js";
import { executeGitHubApiRequest } from "../../tools/github/githubApiClient.js";
import {
  getCurrentProjectBranch,
  getCurrentProjectRepository,
} from "../../tools/github/githubProjectDefaults.js";

const LATEST_REPO_REGISTRY_PATH = "runtime/repo/latest/latest-repo-registry.json";
const REPO_REGISTRY_SCHEMA_VERSION = 2;
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

function segment(path, index) {
  return normalizeString(path).split("/")[index] || "";
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
    if (p.startsWith("src/tools/")) return "Tool-specific runtime support folder.";
    if (p === "src/memory") return "SG memory and AI context implementation layer.";
    if (p.startsWith("src/memory/context")) return "AI context pack builder area.";
    if (p.startsWith("src/memory/project")) return "Project memory area.";
    if (p.startsWith("src/memory/policies")) return "Memory policy area.";
    if (p === "src/tasks") return "Task layer.";
    if (p === "src/integrations") return "External integration layer.";
    if (p === "src/runtime") return "Runtime workspace and runtime helpers.";
    if (p === "runtime") return "Generated runtime workspace reports.";
    if (p.startsWith("runtime/repo")) return "Generated repository state and registry reports.";
    if (p.startsWith("runtime/render")) return "Generated Render state reports.";
    if (p === "pillars") return "Project principles, architecture notes, and decisions.";
    if (p.startsWith("pillars/workflow")) return "Project workflow and current stage documentation.";
    if (p.startsWith("pillars/modules")) return "Module boundary documentation.";
    if (p.startsWith("pillars/architecture")) return "Architecture map documentation.";
    if (p === "docs") return "Project documentation.";
    if (p === "scripts") return "Utility and smoke-test scripts.";
    return "Repository folder.";
  }

  if (name === "README.md") return "Folder documentation.";
  if (name === "package.json") return "Node.js package manifest.";
  if (name === "package-lock.json") return "Locked Node.js dependency tree.";
  if (name === "index.js") return "JavaScript entry point or public boundary.";
  if (p === "src/memory/contracts.js") return "Shared memory/context contract definitions.";
  if (p.includes("contextPackBuilder")) return "Builds controlled AI context packs from provided inputs.";
  if (p.includes("contextTypes")) return "Defines AI context pack item types and trust labels.";
  if (p.includes("projectMemoryService")) return "Project memory prepare/read-only service skeleton.";
  if (p.includes("projectMemoryTypes")) return "Project memory item types and source labels.";
  if (p.includes("Policy.js")) return "Deterministic memory policy file.";
  if (p.includes("repoRegistryAgent")) return "Builds deterministic repository registry reports.";
  if (p.includes("repoCommitWatcherAgent")) return "Detects new commits and triggers repo registry updates.";
  if (p.includes("repoCommitSearch")) return "Searches recent commits for action-oriented history.";
  if (p.includes("renderEnvAgent")) return "Collects masked Render environment inventory.";
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

function layerForPath(path) {
  const p = normalizeString(path);

  if (p.startsWith("src/agents/")) return "agents";
  if (p.startsWith("src/memory/")) return "memory";
  if (p.startsWith("src/tools/")) return "tools";
  if (p.startsWith("src/runtime/")) return "runtime_helpers";
  if (p.startsWith("src/tasks/")) return "tasks";
  if (p.startsWith("src/integrations/")) return "integrations";
  if (p.startsWith("runtime/")) return "runtime_reports";
  if (p.startsWith("pillars/")) return "pillars";
  if (p.startsWith("docs/")) return "docs";
  if (p.startsWith("scripts/")) return "scripts";
  if (p.startsWith(".github/workflows/")) return "ci";
  if (p === "index.js") return "app_entry";
  if (p === "package.json" || p === "package-lock.json") return "dependencies";
  if (p.startsWith(".env")) return "env_template";

  return "repository";
}

function moduleForPath(path) {
  const p = normalizeString(path);

  if (p.startsWith("src/agents/")) return segment(p, 2) || "agents";
  if (p.startsWith("src/memory/context/")) return "memory_context";
  if (p.startsWith("src/memory/project/")) return "project_memory";
  if (p.startsWith("src/memory/policies/")) return "memory_policies";
  if (p === "src/memory/contracts.js") return "memory_contracts";
  if (p.startsWith("src/memory/")) return "memory";
  if (p.startsWith("src/tools/github/")) return "github_tools";
  if (p.startsWith("src/runtime/workspace/")) return "workspace_runtime";
  if (p.startsWith("runtime/repo/")) return "repo_runtime_reports";
  if (p.startsWith("runtime/render/")) return "render_runtime_reports";
  if (p.startsWith("pillars/workflow/")) return "workflow";
  if (p.startsWith("pillars/modules/")) return segment(p, 2) || "modules";
  if (p.startsWith("pillars/architecture/")) return "architecture";
  if (p.startsWith(".github/workflows/")) return "github_actions";

  return layerForPath(p);
}

function ownerForPath(path) {
  const p = normalizeString(path);

  if (p.startsWith("src/agents/")) return "agents";
  if (p.startsWith("src/memory/")) return "memory";
  if (p.startsWith("src/tools/")) return "tools";
  if (p.startsWith("src/runtime/")) return "runtime";
  if (p.startsWith("runtime/")) return "generated_runtime";
  if (p.startsWith("pillars/")) return "architecture_pillars";
  if (p.startsWith("docs/")) return "documentation";
  if (p.startsWith(".github/")) return "ci";
  if (p === "index.js") return "core_entry";
  if (p === "package.json" || p === "package-lock.json") return "dependencies";

  return "repository";
}

function safeToEditForPath(path) {
  const p = normalizeString(path);

  if (p.startsWith("runtime/")) return "generated_do_not_edit_manually";
  if (p.startsWith("pillars/")) return "with_monarch_approval_pr_only";
  if (p.startsWith("src/")) return "with_pr_only";
  if (p.startsWith(".github/workflows/")) return "with_caution_pr_only";
  if (p === "package-lock.json") return "dependency_change_only";
  if (p === "package.json") return "with_caution_pr_only";

  return "with_pr_only";
}

function runtimeImpactForPath(path, type) {
  const p = normalizeString(path);

  if (type === "tree") return "none_folder";
  if (p.startsWith("runtime/")) return "none_generated_report";
  if (p.startsWith("pillars/") || p.startsWith("docs/") || p.endsWith("README.md")) return "none_documentation";
  if (p.startsWith("src/memory/") && (p.includes("skeleton") || p.includes("Policy") || p.includes("contracts"))) return "none_currently_skeleton_or_contract";
  if (p.startsWith("src/agents/")) return "agent_runtime_possible";
  if (p.startsWith("src/tools/") || p.startsWith("src/runtime/")) return "runtime_possible";
  if (p === "index.js") return "high_app_entry";
  if (p === "package.json" || p === "package-lock.json") return "dependency_runtime_possible";
  if (p.startsWith(".github/workflows/")) return "ci_runtime_only";

  return "unknown_or_low";
}

function sourcePriorityForPath(path) {
  const p = normalizeString(path);

  if (p.startsWith("pillars/")) return "highest_project_law";
  if (p.startsWith("src/")) return "source_code";
  if (p.startsWith("runtime/")) return "generated_runtime_fact";
  if (p.startsWith(".github/workflows/")) return "ci_config";
  if (p.startsWith("docs/")) return "documentation";
  if (p === "package.json" || p === "package-lock.json") return "dependency_source";

  return "repository_fact";
}

function semanticNotesForPath(path, type) {
  const p = normalizeString(path);
  const notes = [];

  if (type === "tree") notes.push("folder_node");
  if (p.startsWith("runtime/")) notes.push("generated_by_agent_or_runtime");
  if (p.startsWith("src/memory/")) notes.push("part_of_memory_context_foundation");
  if (p.startsWith("src/agents/")) notes.push("agent_specific_boundary");
  if (p.startsWith("pillars/")) notes.push("source_first_project_rule_or_map");
  if (p.includes("README.md")) notes.push("human_readable_boundary_doc");
  if (p.includes("Policy.js")) notes.push("deterministic_policy_no_runtime_connection_expected");
  if (p.includes("contracts.js")) notes.push("shared_contract_surface");
  if (p === "index.js") notes.push("application_entrypoint_handle_with_care");
  if (p === "package.json" || p === "package-lock.json") notes.push("dependency_surface_handle_with_care");

  return notes;
}

function semanticForPath(path, type) {
  const p = normalizeString(path);

  return {
    module: moduleForPath(p),
    layer: layerForPath(p),
    responsibility: describePath(p, type),
    owner: ownerForPath(p),
    safe_to_edit: safeToEditForPath(p),
    runtime_impact: runtimeImpactForPath(p, type),
    source_priority: sourcePriorityForPath(p),
    notes: semanticNotesForPath(p, type),
  };
}

function normalizeTreeItems(tree = []) {
  return tree
    .filter((item) => item?.path && (item.type === "blob" || item.type === "tree"))
    .slice(0, MAX_ITEMS)
    .map((item) => {
      const path = normalizeString(item.path);
      const type = item.type === "tree" ? "folder" : "file";
      const semantic = semanticForPath(path, item.type);

      return {
        path,
        type,
        parent: parentDir(path),
        extension: type === "file" ? extensionOf(path) : "",
        description: semantic.responsibility,
        status: statusForPath(path, item.type),
        semantic,
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
    schema_version: REPO_REGISTRY_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    repo: safeRepo,
    branch: safeBranch,
    head_sha: headSha,
    truncated: treeResult.truncated,
    items_count: items.length,
    semantic_fields: [
      "module",
      "layer",
      "responsibility",
      "owner",
      "safe_to_edit",
      "runtime_impact",
      "source_priority",
      "notes",
    ],
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
    schema_version: data.schema_version,
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
