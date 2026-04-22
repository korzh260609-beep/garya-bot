// src/projectMemory/ProjectMemoryContextBuilder.js
// ============================================================================
// Project Memory Context Builder
// Purpose:
// - build universal AI context from structured project memory
// - avoid transport-specific assumptions
// - avoid hard coupling to exact phrases/templates
// - keep project memory as soft background, not runtime proof
// - support one project memory across multiple project areas / repos
// - support scoped AI context loading for multi-repo project memory
// ============================================================================

import {
  readCrossRepoFromMeta,
  readLinkedAreasFromMeta,
  readLinkedRepoScopesFromMeta,
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

function normalizeOptionalText(value) {
  const s = safeText(value).trim().toLowerCase();
  return s || null;
}

function normalizeOptionalBoolean(value) {
  if (typeof value === "boolean") return value;
  return undefined;
}

export function normalizeProjectContextScope(input = {}) {
  const source =
    input && typeof input === "object" && !Array.isArray(input) ? input : {};

  return {
    projectKey: source.projectKey,
    projectArea: normalizeOptionalText(source.projectArea),
    repoScope: normalizeOptionalText(source.repoScope),
    linkedArea: normalizeOptionalText(source.linkedArea),
    linkedRepo: normalizeOptionalText(source.linkedRepo),
    crossRepo: normalizeOptionalBoolean(source.crossRepo),
  };
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

function includesNormalized(list = [], needle = "") {
  const target = safeText(needle).toLowerCase();
  if (!target) return true;

  return Array.isArray(list)
    ? list.some((item) => safeText(item).toLowerCase() === target)
    : false;
}

function matchesContextScope(entry, scope = {}) {
  if (!isAiContextEligible(entry)) return false;

  const area = readProjectAreaFromMeta(entry.meta);
  const repo = readRepoScopeFromMeta(entry.meta);
  const linkedAreas = readLinkedAreasFromMeta(entry.meta);
  const linkedRepoScopes = readLinkedRepoScopesFromMeta(entry.meta);
  const isCrossRepo = readCrossRepoFromMeta(entry.meta);

  if (!matchOptional(area, scope.projectArea)) {
    return false;
  }

  if (!matchOptional(repo, scope.repoScope)) {
    return false;
  }

  if (scope.linkedArea && !includesNormalized(linkedAreas, scope.linkedArea)) {
    return false;
  }

  if (scope.linkedRepo && !includesNormalized(linkedRepoScopes, scope.linkedRepo)) {
    return false;
  }

  if (typeof scope.crossRepo === "boolean") {
    return isCrossRepo === scope.crossRepo;
  }

  return true;
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
  const area = readProjectAreaFromMeta(item.meta) || "-";
  const repo = readRepoScopeFromMeta(item.meta) || "-";
  const linkedAreas = readLinkedAreasFromMeta(item.meta);
  const linkedRepos = readLinkedRepoScopesFromMeta(item.meta);
  const crossRepo = readCrossRepoFromMeta(item.meta) === true ? "yes" : "no";
  const title = item.title || item.section || item.entry_type || "entry";

  const headerBits = [
    `area=${area}`,
    `repo=${repo}`,
    `cross_repo=${crossRepo}`,
  ];

  if (linkedAreas.length) {
    headerBits.push(`linked_areas=${linkedAreas.join("|")}`);
  }

  if (linkedRepos.length) {
    headerBits.push(`linked_repos=${linkedRepos.join("|")}`);
  }

  return `${title} [${headerBits.join(", ")}]`;
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

function buildScopeLabel(scope = {}) {
  const bits = [];

  if (scope.projectArea) bits.push(`area=${scope.projectArea}`);
  if (scope.repoScope) bits.push(`repo=${scope.repoScope}`);
  if (scope.linkedArea) bits.push(`linked_area=${scope.linkedArea}`);
  if (scope.linkedRepo) bits.push(`linked_repo=${scope.linkedRepo}`);
  if (typeof scope.crossRepo === "boolean") {
    bits.push(`cross_repo=${scope.crossRepo ? "yes" : "no"}`);
  }

  return bits.length ? ` [${bits.join(", ")}]` : "";
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

  async listAiContextEligibleEntries(input = {}) {
    const scope = normalizeProjectContextScope(input);
    const entries = await this.listConfirmedEntries({
      projectKey: scope.projectKey,
    });

    return entries.filter((item) => matchesContextScope(item, scope));
  }

  async buildConfirmedContext(input = {}) {
    const scope = normalizeProjectContextScope(input);

    const confirmedEntries = await this.listAiContextEligibleEntries(scope);
    const grouped = splitConfirmedEntries(confirmedEntries);
    const blocks = buildConfirmedBlocks(grouped);

    if (!blocks.length) return "";

    const scopeLabel = buildScopeLabel(scope);

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
    const linkedAreas = new Set();
    const linkedRepoScopes = new Set();

    let aiContextEligibleTotal = 0;
    let crossRepoTotal = 0;

    for (const item of entries) {
      if (item.section) sections.add(item.section);
      if (item.entry_type) entryTypes.add(item.entry_type);
      if (item.module_key) moduleKeys.add(item.module_key);
      if (item.stage_key) stageKeys.add(item.stage_key);

      const area = readProjectAreaFromMeta(item.meta);
      if (area) {
        projectAreas.add(area);
      }

      const repo = readRepoScopeFromMeta(item.meta);
      if (repo) repoScopes.add(repo);

      for (const areaItem of readLinkedAreasFromMeta(item.meta)) {
        if (areaItem) linkedAreas.add(areaItem);
      }

      for (const repoItem of readLinkedRepoScopesFromMeta(item.meta)) {
        if (repoItem) linkedRepoScopes.add(repoItem);
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
      linkedAreas: Array.from(linkedAreas).sort(),
      linkedRepoScopes: Array.from(linkedRepoScopes).sort(),
      relatedPaths: Array.from(relatedPaths).sort(),
      confirmedEntryTypes: Array.from(CONFIRMED_ENTRY_TYPES).sort(),
    };
  }
}

export default ProjectMemoryContextBuilder;