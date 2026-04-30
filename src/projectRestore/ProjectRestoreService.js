// src/projectRestore/ProjectRestoreService.js
// ============================================================================
// Stage 7A.9 — Project Work Auto-Restore skeleton
// Purpose:
// - prepare a read-only project state snapshot before project/repo work;
// - keep Project Memory subordinate to pillars/repo/runtime facts;
// - distinguish confirmed project memory from chat memory and runtime proof;
// - expose restore diagnostics in shadow mode;
// - avoid any writes, routing changes, or normal chat interception.
// ============================================================================

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_PROJECT_KEY = "garya_ai";
const DEFAULT_MODE = "shadow";
const SERVICE_VERSION = "stage-7A.9-skeleton-v3-configurable-workflow-source";
const DEFAULT_WORKFLOW_DIR_RELATIVE_PATH = "pillars/workflow";
const WORKFLOW_FILE_MAX_CHARS = 2500;
const WORKFLOW_TOTAL_MAX_CHARS = 9000;

function safeText(value) {
  return String(value ?? "").trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isFn(value) {
  return typeof value === "function";
}

function compactText(value, maxChars = 1200) {
  const text = safeText(value);
  const limit = Number(maxChars || 0);

  if (!text || !Number.isFinite(limit) || limit <= 0) {
    return "";
  }

  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, Math.max(0, limit - 24)).trimEnd()}\n...[truncated]`;
}

function normalizeMode(value) {
  const mode = safeText(value).toLowerCase();
  return mode === "active" ? "active" : DEFAULT_MODE;
}

function normalizeProjectKey(value) {
  return safeText(value) || DEFAULT_PROJECT_KEY;
}

function normalizeRelativePath(value, fallback) {
  const raw = safeText(value) || fallback;
  const normalized = raw.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");

  if (!normalized || normalized.includes("..")) {
    return fallback;
  }

  return normalized;
}

function buildEmptySourceState(sourceKey) {
  return {
    sourceKey,
    ok: false,
    available: false,
    items: [],
    text: "",
    warnings: [],
    error: null,
    meta: {},
  };
}

function buildSourceState({ sourceKey, available = false, items = [], text = "", warnings = [], error = null, meta = {} } = {}) {
  return {
    sourceKey,
    ok: available && !error,
    available: Boolean(available),
    items: safeArray(items),
    text: safeText(text),
    warnings: safeArray(warnings).map(safeText).filter(Boolean),
    error: error ? safeText(error?.message || error) : null,
    meta: meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {},
  };
}

function collectSourceSummary(state = {}) {
  const keys = [
    "workflow",
    "confirmedMemory",
    "chatMemory",
    "repoFacts",
    "commitMap",
    "deployHistory",
    "risks",
    "constraints",
    "nextSafeStep",
  ];

  return keys.map((key) => {
    const item = state[key] || buildEmptySourceState(key);
    return {
      sourceKey: key,
      ok: item.ok === true,
      available: item.available === true,
      itemCount: safeArray(item.items).length,
      hasText: Boolean(safeText(item.text)),
      warningCount: safeArray(item.warnings).length,
      error: item.error || null,
      meta: item.meta || {},
    };
  });
}

function buildWarningsFromSources(sourceSummary = []) {
  const warnings = [];

  for (const item of safeArray(sourceSummary)) {
    if (!item.available) {
      warnings.push(`${item.sourceKey}: source unavailable or not wired yet`);
    }

    if (item.error) {
      warnings.push(`${item.sourceKey}: ${item.error}`);
    }
  }

  return warnings;
}

function extractMarkdownTitle(content = "", fallback = "") {
  const lines = String(content ?? "").split(/\r?\n/);
  const firstHeading = lines.find((line) => /^#\s+/.test(String(line || "").trim()));

  if (firstHeading) {
    return firstHeading.replace(/^#\s+/, "").trim();
  }

  return fallback;
}

async function pathExists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

export function resolveWorkflowDir(input = {}) {
  return normalizeRelativePath(
    input.workflowDir || process.env.SG_WORKFLOW_DIR,
    DEFAULT_WORKFLOW_DIR_RELATIVE_PATH
  );
}

export async function readWorkflowFolderState(input = {}) {
  const rootDir = process.cwd();
  const relativeDir = resolveWorkflowDir(input);
  const absDir = path.resolve(rootDir, relativeDir);
  const warnings = [];

  if (relativeDir !== DEFAULT_WORKFLOW_DIR_RELATIVE_PATH) {
    warnings.push(`workflow folder override active: ${relativeDir}`);
  }

  if (!(await pathExists(absDir))) {
    return {
      items: [],
      text: "",
      warnings: [...warnings, `workflow folder not found: ${relativeDir}`],
      meta: {
        workflowDir: relativeDir,
        defaultWorkflowDir: DEFAULT_WORKFLOW_DIR_RELATIVE_PATH,
        sourceType: "folder",
      },
    };
  }

  const dirEntries = await fs.readdir(absDir, { withFileTypes: true });
  const mdFiles = dirEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.toLowerCase().endsWith(".md"))
    .sort((a, b) => a.localeCompare(b));

  const items = [];
  const blocks = [];

  for (const fileName of mdFiles) {
    const relativePath = path.posix.join(relativeDir, fileName);
    const absPath = path.join(absDir, fileName);
    const rawContent = await fs.readFile(absPath, "utf-8");
    const title = extractMarkdownTitle(rawContent, fileName);
    const compactContent = compactText(rawContent, WORKFLOW_FILE_MAX_CHARS);

    items.push({
      path: relativePath,
      title,
      chars: rawContent.length,
      truncated: rawContent.length > compactContent.length,
    });

    blocks.push([`FILE: ${relativePath}`, `TITLE: ${title}`, compactContent].join("\n"));
  }

  if (mdFiles.length === 0) {
    warnings.push(`workflow folder has no markdown files: ${relativeDir}`);
  }

  const text = compactText(blocks.join("\n\n---\n\n"), WORKFLOW_TOTAL_MAX_CHARS);

  return {
    items,
    text,
    warnings,
    meta: {
      workflowDir: relativeDir,
      defaultWorkflowDir: DEFAULT_WORKFLOW_DIR_RELATIVE_PATH,
      sourceType: "folder",
      fileCount: mdFiles.length,
    },
  };
}

export class ProjectRestoreService {
  constructor({
    projectKey = DEFAULT_PROJECT_KEY,
    workflowDir = null,
    buildConfirmedProjectMemoryDigest = null,
    buildConfirmedProjectMemoryContext = null,
    getChatHistory = null,
    readWorkflowState = readWorkflowFolderState,
    readRepoFacts = null,
    readCommitMap = null,
    readDeployHistory = null,
  } = {}) {
    this.projectKey = normalizeProjectKey(projectKey);
    this.workflowDir = resolveWorkflowDir({ workflowDir });
    this.buildConfirmedProjectMemoryDigest = buildConfirmedProjectMemoryDigest;
    this.buildConfirmedProjectMemoryContext = buildConfirmedProjectMemoryContext;
    this.getChatHistory = getChatHistory;
    this.readWorkflowState = readWorkflowState;
    this.readRepoFacts = readRepoFacts;
    this.readCommitMap = readCommitMap;
    this.readDeployHistory = readDeployHistory;
  }

  async loadWorkflowState(input = {}) {
    if (!isFn(this.readWorkflowState)) {
      return buildSourceState({
        sourceKey: "workflow",
        warnings: ["readWorkflowState is not wired; workflow source must be configured, default is pillars/workflow"],
        meta: {
          workflowDir: this.workflowDir,
          defaultWorkflowDir: DEFAULT_WORKFLOW_DIR_RELATIVE_PATH,
        },
      });
    }

    try {
      const result = await this.readWorkflowState({
        ...input,
        workflowDir: input.workflowDir || this.workflowDir,
      });
      return buildSourceState({
        sourceKey: "workflow",
        available: safeArray(result?.items).length > 0 || Boolean(safeText(result?.text)),
        items: safeArray(result?.items),
        text: result?.text || "",
        warnings: safeArray(result?.warnings),
        meta: result?.meta || {
          workflowDir: this.workflowDir,
          defaultWorkflowDir: DEFAULT_WORKFLOW_DIR_RELATIVE_PATH,
        },
      });
    } catch (err) {
      return buildSourceState({
        sourceKey: "workflow",
        error: err,
        meta: {
          workflowDir: this.workflowDir,
          defaultWorkflowDir: DEFAULT_WORKFLOW_DIR_RELATIVE_PATH,
        },
      });
    }
  }

  async loadConfirmedMemory(input = {}) {
    const items = [];
    const warnings = [];
    let text = "";

    try {
      if (isFn(this.buildConfirmedProjectMemoryDigest)) {
        const digest = await this.buildConfirmedProjectMemoryDigest({
          projectKey: input.projectKey || this.projectKey,
        });
        items.push({ type: "digest", value: digest });
      } else {
        warnings.push("buildConfirmedProjectMemoryDigest is not wired");
      }

      if (isFn(this.buildConfirmedProjectMemoryContext)) {
        text = await this.buildConfirmedProjectMemoryContext({
          projectKey: input.projectKey || this.projectKey,
        });
      } else {
        warnings.push("buildConfirmedProjectMemoryContext is not wired");
      }

      return buildSourceState({
        sourceKey: "confirmedMemory",
        available: items.length > 0 || Boolean(text),
        items,
        text,
        warnings,
      });
    } catch (err) {
      return buildSourceState({ sourceKey: "confirmedMemory", error: err });
    }
  }

  async loadChatMemory(input = {}) {
    if (!isFn(this.getChatHistory) || !input.chatId) {
      return buildSourceState({
        sourceKey: "chatMemory",
        warnings: ["chat history is not requested or getChatHistory is not wired"],
      });
    }

    try {
      const history = await this.getChatHistory(input.chatId, input.limit || 10);
      return buildSourceState({
        sourceKey: "chatMemory",
        available: true,
        items: safeArray(history),
        warnings: ["chat memory is local context only; it is not confirmed Project Memory"],
      });
    } catch (err) {
      return buildSourceState({ sourceKey: "chatMemory", error: err });
    }
  }

  async loadRepoFacts(input = {}) {
    if (!isFn(this.readRepoFacts)) {
      return buildSourceState({
        sourceKey: "repoFacts",
        warnings: ["readRepoFacts is not wired; repository/runtime facts remain external source of truth"],
      });
    }

    try {
      const result = await this.readRepoFacts(input);
      return buildSourceState({
        sourceKey: "repoFacts",
        available: true,
        items: safeArray(result?.items),
        text: result?.text || "",
        warnings: safeArray(result?.warnings),
      });
    } catch (err) {
      return buildSourceState({ sourceKey: "repoFacts", error: err });
    }
  }

  async loadCommitMap(input = {}) {
    if (!isFn(this.readCommitMap)) {
      return buildSourceState({
        sourceKey: "commitMap",
        warnings: ["readCommitMap is not wired; ProjectCommitMapService is a future service"],
      });
    }

    try {
      const result = await this.readCommitMap(input);
      return buildSourceState({
        sourceKey: "commitMap",
        available: true,
        items: safeArray(result?.items),
        text: result?.text || "",
        warnings: safeArray(result?.warnings),
      });
    } catch (err) {
      return buildSourceState({ sourceKey: "commitMap", error: err });
    }
  }

  async loadDeployHistory(input = {}) {
    if (!isFn(this.readDeployHistory)) {
      return buildSourceState({
        sourceKey: "deployHistory",
        warnings: ["readDeployHistory is not wired; deploy history is a future source"],
      });
    }

    try {
      const result = await this.readDeployHistory(input);
      return buildSourceState({
        sourceKey: "deployHistory",
        available: true,
        items: safeArray(result?.items),
        text: result?.text || "",
        warnings: safeArray(result?.warnings),
      });
    } catch (err) {
      return buildSourceState({ sourceKey: "deployHistory", error: err });
    }
  }

  extractDerivedState({ confirmedMemory, workflow } = {}) {
    return {
      risks: buildSourceState({
        sourceKey: "risks",
        available: Boolean(confirmedMemory?.available || workflow?.available),
        warnings: ["risk extraction is skeleton-only; do not treat as complete"],
      }),
      constraints: buildSourceState({
        sourceKey: "constraints",
        available: Boolean(confirmedMemory?.available || workflow?.available),
        warnings: ["constraint extraction is skeleton-only; confirmed constraints must come from Project Memory/pillars"],
      }),
      nextSafeStep: buildSourceState({
        sourceKey: "nextSafeStep",
        available: Boolean(workflow?.available),
        warnings: ["next safe step extraction is skeleton-only; workflow/pillars remain authoritative"],
      }),
    };
  }

  async loadProjectState(input = {}) {
    const projectKey = normalizeProjectKey(input.projectKey || this.projectKey);
    const mode = normalizeMode(input.mode);

    const workflow = await this.loadWorkflowState({ ...input, projectKey, mode });
    const confirmedMemory = await this.loadConfirmedMemory({ ...input, projectKey, mode });
    const chatMemory = await this.loadChatMemory({ ...input, projectKey, mode });
    const repoFacts = await this.loadRepoFacts({ ...input, projectKey, mode });
    const commitMap = await this.loadCommitMap({ ...input, projectKey, mode });
    const deployHistory = await this.loadDeployHistory({ ...input, projectKey, mode });

    const derived = this.extractDerivedState({ confirmedMemory, workflow });

    const state = {
      ok: true,
      service: "ProjectRestoreService",
      version: SERVICE_VERSION,
      mode,
      projectKey,
      workflow,
      confirmedMemory,
      chatMemory,
      repoFacts,
      commitMap,
      deployHistory,
      ...derived,
    };

    state.sourceSummary = collectSourceSummary(state);
    state.warnings = buildWarningsFromSources(state.sourceSummary);
    state.diagnostics = this.buildRestoreDiagnosticsFromState(state);

    return state;
  }

  buildContextTextFromState(state = {}) {
    const lines = [];

    lines.push("PROJECT RESTORE CONTEXT (READ-ONLY, SHADOW-SAFE):");
    lines.push("Project Memory is background, not runtime proof.");
    lines.push("Workflow truth must come from configured pillars workflow source.");
    lines.push("Default workflow source is pillars/workflow, but pillars structure may change.");
    lines.push("Repository/runtime facts must be verified from repo/runtime before code decisions.");
    lines.push("");

    if (state.workflow?.meta?.workflowDir) {
      lines.push(`WORKFLOW SOURCE: ${state.workflow.meta.workflowDir}`);
      lines.push("");
    }

    if (state.workflow?.text) {
      lines.push("WORKFLOW SNAPSHOT:");
      lines.push(compactText(state.workflow.text, 1600));
      lines.push("");
    }

    if (state.confirmedMemory?.text) {
      lines.push("CONFIRMED PROJECT MEMORY SNAPSHOT:");
      lines.push(compactText(state.confirmedMemory.text, 1200));
      lines.push("");
    }

    if (state.repoFacts?.text) {
      lines.push("REPO FACTS SNAPSHOT:");
      lines.push(compactText(state.repoFacts.text, 900));
      lines.push("");
    }

    if (state.commitMap?.text) {
      lines.push("COMMIT MAP SNAPSHOT:");
      lines.push(compactText(state.commitMap.text, 700));
      lines.push("");
    }

    if (state.deployHistory?.text) {
      lines.push("DEPLOY HISTORY SNAPSHOT:");
      lines.push(compactText(state.deployHistory.text, 500));
      lines.push("");
    }

    if (safeArray(state.warnings).length) {
      lines.push("RESTORE WARNINGS:");
      for (const warning of state.warnings.slice(0, 12)) {
        lines.push(`- ${warning}`);
      }
    }

    return compactText(lines.join("\n"), 4000);
  }

  async restoreProjectContext(input = {}) {
    const state = await this.loadProjectState(input);
    const contextText = this.buildContextTextFromState(state);

    return {
      ok: true,
      service: "ProjectRestoreService",
      version: SERVICE_VERSION,
      mode: state.mode,
      projectKey: state.projectKey,
      contextText,
      state,
      warnings: safeArray(state.warnings),
      sourceSummary: safeArray(state.sourceSummary),
    };
  }

  buildRestoreDiagnosticsFromState(state = {}) {
    const sourceSummary = collectSourceSummary(state);
    const checkedSources = sourceSummary.map((item) => item.sourceKey);
    const missingSources = sourceSummary
      .filter((item) => !item.available)
      .map((item) => item.sourceKey);
    const staleSources = [];
    const warnings = buildWarningsFromSources(sourceSummary);
    const workflowDir = state.workflow?.meta?.workflowDir || this.workflowDir;

    return {
      ok: missingSources.length === 0,
      service: "ProjectRestoreService",
      version: SERVICE_VERSION,
      mode: state.mode || DEFAULT_MODE,
      projectKey: state.projectKey || this.projectKey,
      workflowDir,
      defaultWorkflowDir: DEFAULT_WORKFLOW_DIR_RELATIVE_PATH,
      checkedSources,
      missingSources,
      staleSources,
      warnings,
      limits: {
        contextTextChars: 4000,
        workflowFileChars: WORKFLOW_FILE_MAX_CHARS,
        workflowTotalChars: WORKFLOW_TOTAL_MAX_CHARS,
        workflowContextChars: 1600,
        confirmedMemoryTextChars: 1200,
        repoFactsTextChars: 900,
        commitMapTextChars: 700,
        deployHistoryTextChars: 500,
      },
      recommendation:
        missingSources.length > 0
          ? "Keep ProjectRestoreService in shadow mode until missing sources are wired. If pillars workflow path changes, set workflowDir or SG_WORKFLOW_DIR."
          : "Restore sources are wired; keep read-only diagnostics before runtime integration.",
    };
  }

  async buildRestoreDiagnostics(input = {}) {
    const state = await this.loadProjectState(input);
    return this.buildRestoreDiagnosticsFromState(state);
  }
}

export default ProjectRestoreService;
