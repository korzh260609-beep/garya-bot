// src/projectMemory/ProjectMemoryConfirmedReader.js
// ============================================================================
// Project Memory Confirmed Reader
// Purpose:
// - universal read use-cases for confirmed project memory
// - transport-agnostic
// - no Telegram/Discord/Web assumptions
// - expose curated memory as structured data, not transport formatting
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
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

function normalizeLimit(value, def = 50, min = 1, max = 200) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(n)) return def;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function applyConfirmedFilters(entries = [], filters = {}) {
  const moduleKey = safeText(filters.moduleKey);
  const stageKey = safeText(filters.stageKey);
  const section = safeText(filters.section);
  const entryType = safeText(filters.entryType);

  return entries.filter((item) => {
    if (!isConfirmedEntry(item)) return false;
    if (moduleKey && safeText(item.module_key) !== moduleKey) return false;
    if (stageKey && safeText(item.stage_key) !== stageKey) return false;
    if (section && safeText(item.section) !== section) return false;
    if (entryType && safeText(item.entry_type) !== entryType) return false;
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
    limit = 50,
  } = {}) {
    const rawEntries = await this.service.listEntries(projectKey, {
      isActive: true,
      limit: Math.max(200, normalizeLimit(limit, 50, 1, 500)),
    });

    const filtered = applyConfirmedFilters(rawEntries, {
      moduleKey,
      stageKey,
      section,
      entryType,
    });

    return filtered.slice(0, normalizeLimit(limit, 50, 1, 200));
  }

  async getLatestEntry({
    projectKey,
    moduleKey = null,
    stageKey = null,
    section = null,
    entryType = null,
  } = {}) {
    const items = await this.listEntries({
      projectKey,
      moduleKey,
      stageKey,
      section,
      entryType,
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
    limit = 50,
  } = {}) {
    const entries = await this.listEntries({
      projectKey,
      moduleKey,
      stageKey,
      section,
      entryType,
      limit,
    });

    const sections = new Set();
    const entryTypes = new Set();
    const moduleKeys = new Set();
    const stageKeys = new Set();
    const relatedPaths = new Set();

    for (const item of entries) {
      if (item.section) sections.add(item.section);
      if (item.entry_type) entryTypes.add(item.entry_type);
      if (item.module_key) moduleKeys.add(item.module_key);
      if (item.stage_key) stageKeys.add(item.stage_key);

      if (Array.isArray(item.related_paths)) {
        for (const relatedPath of item.related_paths) {
          if (relatedPath) relatedPaths.add(relatedPath);
        }
      }
    }

    return {
      totalEntries: entries.length,
      sections: Array.from(sections).sort(),
      entryTypes: Array.from(entryTypes).sort(),
      moduleKeys: Array.from(moduleKeys).sort(),
      stageKeys: Array.from(stageKeys).sort(),
      relatedPaths: Array.from(relatedPaths).sort(),
      filters: {
        moduleKey: moduleKey || null,
        stageKey: stageKey || null,
        section: section || null,
        entryType: entryType || null,
      },
    };
  }
}

export default ProjectMemoryConfirmedReader;
