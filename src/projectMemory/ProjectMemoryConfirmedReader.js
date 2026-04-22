// src/projectMemory/ProjectMemoryConfirmedReader.js
// ============================================================================
// Project Memory Confirmed Reader
// Purpose:
// - universal read use-cases for confirmed project memory
// - transport-agnostic
// - no Telegram/Discord/Web assumptions
// - expose curated memory as structured data, not transport formatting
// - support one project memory across multiple repos / project areas
// ============================================================================

import {
  readCrossRepoFromMeta,
  readProjectAreaFromMeta,
  readRepoScopeFromMeta,
} from "./projectMemoryScopes.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeMeta(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

const CONFIRMED_ENTRY_TYPES = new Set([
  "section_state",
  "decision",
  "constraint",
  "next_step",
]);

function isConfirmedEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (entry.is_active !== true) return false;
  return CONFIRMED_ENTRY_TYPES.has(safeText(entry.entry_type));
}

function isAiContextEligible(entry) {
  if (!isConfirmedEntry(entry)) return false;

  const meta = normalizeMeta(entry.meta);
  const entryType = safeText(entry.entry_type);

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

function normalizeLimit(value, def = 50, min = 1, max = 200) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(n)) return def;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function normalizeAiContextFilter(value) {
  if (typeof value === "boolean") return value;
  if (value === null) return null;
  return undefined;
}

function normalizeBooleanFilter(value) {
  if (typeof value === "boolean") return value;
  if (value === null) return null;
  return undefined;
}

function applyConfirmedFilters(entries = [], filters = {}) {
  const moduleKey = safeText(filters.moduleKey);
  const stageKey = safeText(filters.stageKey);
  const section = safeText(filters.section);
  const entryType = safeText(filters.entryType);
  const projectArea = safeText(filters.projectArea).toLowerCase();
  const repoScope = safeText(filters.repoScope).toLowerCase();
  const aiContext = normalizeAiContextFilter(filters.aiContext);
  const crossRepo = normalizeBooleanFilter(filters.crossRepo);

  return entries.filter((item) => {
    if (!isConfirmedEntry(item)) return false;
    if (moduleKey && safeText(item.module_key) !== moduleKey) return false;
    if (stageKey && safeText(item.stage_key) !== stageKey) return false;
    if (section && safeText(item.section) !== section) return false;
    if (entryType && safeText(item.entry_type) !== entryType) return false;

    const area = readProjectAreaFromMeta(item.meta);
    const repo = readRepoScopeFromMeta(item.meta);
    const isCrossRepo = readCrossRepoFromMeta(item.meta);

    if (projectArea && area !== projectArea) return false;
    if (repoScope && repo !== repoScope) return false;
    if (crossRepo === true && isCrossRepo !== true) return false;
    if (crossRepo === false && isCrossRepo === true) return false;

    if (aiContext === true && !isAiContextEligible(item)) return false;
    if (aiContext === false && isAiContextEligible(item)) return false;

    return true;
  });
}

export class ProjectMemoryConfirmedReader {
  constructor({ service }) {
    this.service = service;
  }

  async listEntries({
    projectKey,
    moduleKey = null,
    stageKey = null,
    section = null,
    entryType = null,
    projectArea = null,
    repoScope = null,
    crossRepo = undefined,
    aiContext = undefined,
    limit = 50,
  } = {}) {
    const targetLimit = normalizeLimit(limit, 50, 1, 200);

    const rawEntries = await this.service.listEntries(projectKey, {
      isActive: true,
      limit: Math.max(200, targetLimit),
    });

    const filtered = applyConfirmedFilters(rawEntries, {
      moduleKey,
      stageKey,
      section,
      entryType,
      projectArea,
      repoScope,
      crossRepo,
      aiContext,
    });

    return filtered.slice(0, targetLimit);
  }

  async getLatestEntry({
    projectKey,
    moduleKey = null,
    stageKey = null,
    section = null,
    entryType = null,
    projectArea = null,
    repoScope = null,
    crossRepo = undefined,
    aiContext = undefined,
  } = {}) {
    const items = await this.listEntries({
      projectKey,
      moduleKey,
      stageKey,
      section,
      entryType,
      projectArea,
      repoScope,
      crossRepo,
      aiContext,
      limit: 1,
    });

    return items[0] || null;
  }

  async buildDigest({
    projectKey,
    moduleKey = null,
    stageKey = null,
    section = null,
    entryType = null,
    projectArea = null,
    repoScope = null,
    crossRepo = undefined,
    aiContext = undefined,
    limit = 50,
  } = {}) {
    const entries = await this.listEntries({
      projectKey,
      moduleKey,
      stageKey,
      section,
      entryType,
      projectArea,
      repoScope,
      crossRepo,
      aiContext,
      limit,
    });

    const sections = new Set();
    const entryTypes = new Set();
    const moduleKeys = new Set();
    const stageKeys = new Set();
    const relatedPaths = new Set();
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

      if (isAiContextEligible(item)) aiContextEligibleTotal += 1;
      if (readCrossRepoFromMeta(item.meta) === true) crossRepoTotal += 1;

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
      filters: {
        moduleKey: moduleKey || null,
        stageKey: stageKey || null,
        section: section || null,
        entryType: entryType || null,
        projectArea: projectArea || null,
        repoScope: repoScope || null,
        crossRepo:
          typeof crossRepo === "boolean"
            ? crossRepo
            : null,
        aiContext:
          typeof aiContext === "boolean"
            ? aiContext
            : null,
      },
    };
  }
}

export default ProjectMemoryConfirmedReader;