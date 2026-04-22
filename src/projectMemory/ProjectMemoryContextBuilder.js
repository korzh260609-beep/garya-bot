// src/projectMemory/ProjectMemoryContextBuilder.js
// ============================================================================
// Project Memory Context Builder
// Purpose:
// - build universal AI context from structured project memory
// - avoid transport-specific assumptions
// - avoid hard coupling to exact phrases/templates
// - keep project memory as soft background, not runtime proof
// - support one project memory across multiple project areas / repos
// ============================================================================

import {
  readCrossRepoFromMeta,
  readProjectAreaFromMeta,
  readRepoScopeFromMeta,
} from "./projectMemoryScopes.js";

function safeText(value) {
  return String(value ?? "");
}

function compactText(text, maxChars = 1200) {
  const s = safeText(text).trim();
  if (!s) return "";
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + "\n...[TRUNCATED]...";
}

function normalizeMeta(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export const PROJECT_MEMORY_CONTEXT_SCOPES = Object.freeze({
  CONFIRMED: "confirmed",
  SOFT: "soft",
});

const CONFIRMED_ENTRY_TYPES = new Set([
  "section_state",
  "decision",
  "constraint",
  "next_step",
]);

function isConfirmedContextEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (entry.is_active !== true) return false;

  const entryType = safeText(entry.entry_type).trim();
  if (!entryType) return false;

  return CONFIRMED_ENTRY_TYPES.has(entryType);
}

function isAiContextEligible(entry) {
  if (!isConfirmedContextEntry(entry)) {
    return false;
  }

  const meta = normalizeMeta(entry.meta);
  const entryType = safeText(entry.entry_type).trim();

  if (entryType === "section_state") {
    return meta.aiContext === true;
  }

  if (
    entryType === "decision" ||
    entryType === "constraint" ||
    entryType === "next_step"
  ) {
    return meta.aiContext !== false;
  }

  return false;
}

function matchOptional(value, filterValue) {
  const a = safeText(value).toLowerCase();
  const b = safeText(filterValue).toLowerCase();

  if (!b) return true;
  return a === b;
}

function splitConfirmedEntries(entries = []) {
  const out = {
    sectionStates: [],
    decisions: [],
    constraints: [],
    nextSteps: [],
  };

  for (const item of entries) {
    if (!isAiContextEligible(item)) {
      continue;
    }

    switch (String(item.entry_type)) {
      case "section_state":
        out.sectionStates.push(item);
        break;
      case "decision":
        out.decisions.push(item);
        break;
      case "constraint":
        out.constraints.push(item);
        break;
      case "next_step":
        out.nextSteps.push(item);
        break;
      default:
        break;
    }
  }

  return out;
}

function buildHeader(item) {
  const area = readProjectAreaFromMeta(item.meta);
  const repo = readRepoScopeFromMeta(item.meta) || "-";
  const crossRepo = readCrossRepoFromMeta(item.meta) === true ? "yes" : "no";
  const title = item.title || item.section || item.entry_type || "entry";

  return `${title} [area=${area}, repo=${repo}, cross_repo=${crossRepo}]`;
}

function buildConfirmedBlocks({
  sectionStates = [],
  decisions = [],
  constraints = [],
  nextSteps = [],
}) {
  const blocks = [];

  if (sectionStates.length) {
    const lines = [];

    for (const item of sectionStates.slice(0, 8)) {
      const header = buildHeader(item);
      const body = compactText(item.content, 500);
      lines.push(`- ${header}\n${body}`);
    }

    if (lines.length) {
      blocks.push(["SECTION STATE:", ...lines].join("\n"));
    }
  }

  if (decisions.length) {
    const lines = [];

    for (const item of decisions.slice(0, 8)) {
      const header = buildHeader(item);
      const body = compactText(item.content, 400);
      lines.push(`- ${header}\n${body}`);
    }

    if (lines.length) {
      blocks.push(["DECISIONS:", ...lines].join("\n"));
    }
  }

  if (constraints.length) {
    const lines = [];

    for (const item of constraints.slice(0, 8)) {
      const header = buildHeader(item);
      const body = compactText(item.content, 300);
      lines.push(`- ${header}\n${body}`);
    }

    if (lines.length) {
      blocks.push(["CONSTRAINTS:", ...lines].join("\n"));
    }
  }

  if (nextSteps.length) {
    const lines = [];

    for (const item of nextSteps.slice(0, 8)) {
      const header = buildHeader(item);
      const body = compactText(item.content, 300);
      lines.push(`- ${header}\n${body}`);
    }

    if (lines.length) {
      blocks.push(["NEXT STEPS:", ...lines].join("\n"));
    }
  }

  return blocks;
}

export class ProjectMemoryContextBuilder {
  constructor({ service }) {
    this.service = service;
  }

  async listConfirmedEntries({ projectKey } = {}) {
    const entries = await this.service.listEntries(projectKey, {
      isActive: true,
      limit: 200,
    });

    return Array.isArray(entries)
      ? entries.filter((item) => isConfirmedContextEntry(item))
      : [];
  }

  async listAiContextEligibleEntries({
    projectKey,
    projectArea = null,
    repoScope = null,
    crossRepo = undefined,
  } = {}) {
    const entries = await this.listConfirmedEntries({ projectKey });

    return entries.filter((item) => {
      if (!isAiContextEligible(item)) return false;

      if (!matchOptional(readProjectAreaFromMeta(item.meta), projectArea)) {
        return false;
      }

      if (!matchOptional(readRepoScopeFromMeta(item.meta), repoScope)) {
        return false;
      }

      if (typeof crossRepo === "boolean") {
        return readCrossRepoFromMeta(item.meta) === crossRepo;
      }

      return true;
    });
  }

  async buildConfirmedContext({
    projectKey,
    projectArea = null,
    repoScope = null,
    crossRepo = undefined,
  } = {}) {
    const confirmedEntries = await this.listAiContextEligibleEntries({
      projectKey,
      projectArea,
      repoScope,
      crossRepo,
    });

    const grouped = splitConfirmedEntries(confirmedEntries);
    const blocks = buildConfirmedBlocks(grouped);

    if (!blocks.length) return "";

    const scopeBits = [];
    if (projectArea) scopeBits.push(`area=${projectArea}`);
    if (repoScope) scopeBits.push(`repo=${repoScope}`);
    if (typeof crossRepo === "boolean") {
      scopeBits.push(`cross_repo=${crossRepo ? "yes" : "no"}`);
    }

    const scopeLabel = scopeBits.length ? ` [${scopeBits.join(", ")}]` : "";

    return [
      `PROJECT BACKGROUND CONTEXT${scopeLabel} (CONFIRMED MEMORY, NOT RUNTIME PROOF):`,
      "Use as confirmed background context.",
      "Do not treat this as proof of current runtime implementation state.",
      "Current implementation status must be verified from runtime/repository/pillars.",
      "",
      blocks.join("\n\n"),
    ]
      .join("\n")
      .slice(0, 4000);
  }

  async buildSoftContext(input = {}) {
    return this.buildConfirmedContext(input);
  }

  async buildProjectDigest({ projectKey } = {}) {
    const entries = await this.service.listEntries(projectKey, {
      isActive: true,
      limit: 200,
    });

    const entryTypes = new Set();
    const moduleKeys = new Set();
    const stageKeys = new Set();
    const relatedPaths = new Set();
    const sections = new Set();
    const projectAreas = new Set();
    const repoScopes = new Set();

    let aiContextEligibleTotal = 0;
    let crossRepoTotal = 0;

    for (const item of entries) {
      if (item.section) sections.add(item.section);
      if (item.entry_type) entryTypes.add(item.entry_type);
      if (item.module_key) moduleKeys.add(item.module_key);
      if (item.stage_key) stageKeys.add(item.stage_key);

      projectAreas.add(readProjectAreaFromMeta(item.meta));
      if (readRepoScopeFromMeta(item.meta)) {
        repoScopes.add(readRepoScopeFromMeta(item.meta));
      }

      if (readCrossRepoFromMeta(item.meta) === true) {
        crossRepoTotal += 1;
      }

      if (isAiContextEligible(item)) {
        aiContextEligibleTotal += 1;
      }

      if (Array.isArray(item.related_paths)) {
        for (const relatedPath of item.related_paths) {
          if (relatedPath) relatedPaths.add(relatedPath);
        }
      }
    }

    return {
      totalEntries: entries.length,
      aiContextEligibleTotal,
      crossRepoTotal,
      sections: Array.from(sections).sort(),
      entryTypes: Array.from(entryTypes).sort(),
      moduleKeys: Array.from(moduleKeys).sort(),
      stageKeys: Array.from(stageKeys).sort(),
      projectAreas: Array.from(projectAreas).sort(),
      repoScopes: Array.from(repoScopes).sort(),
      relatedPaths: Array.from(relatedPaths).sort(),
      confirmedEntryTypes: Array.from(CONFIRMED_ENTRY_TYPES).sort(),
    };
  }
}

export default ProjectMemoryContextBuilder;