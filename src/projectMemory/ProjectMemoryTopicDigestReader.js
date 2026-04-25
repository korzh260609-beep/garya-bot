// src/projectMemory/ProjectMemoryTopicDigestReader.js
// ============================================================================
// Project Memory Topic Digest Reader
// Stage: 7A — Project Memory Layer
// Purpose:
// - read topic_digest layer as structured data
// - keep topic digests separate from confirmed memory and raw archive
// - transport-agnostic: no Telegram/Discord/Web assumptions
// - topic digests are soft summaries, not confirmed memory and not runtime proof
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeMeta(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeLimit(value, def = 20, min = 1, max = 100) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(n)) return def;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function compactText(text, maxChars = 900) {
  const s = safeText(text);
  if (!s) return "";
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}\n...[TRUNCATED]...`;
}

const TOPIC_DIGEST_ENTRY_TYPES = new Set([
  "session_summary",
  "topic_digest",
]);

function isTopicDigestEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (entry.is_active !== true) return false;
  if (safeText(entry.layer) !== "topic_digest") return false;
  return TOPIC_DIGEST_ENTRY_TYPES.has(safeText(entry.entry_type));
}

function withDerivedTopicDigestFields(entry) {
  return {
    ...entry,
    meta: normalizeMeta(entry?.meta),
    isTopicDigest: isTopicDigestEntry(entry),
    warning: "Topic digest is a soft summary, not confirmed memory and not runtime proof.",
  };
}

function applyTopicDigestFilters(entries = [], filters = {}) {
  const section = safeText(filters.section);
  const entryType = safeText(filters.entryType);
  const moduleKey = safeText(filters.moduleKey);
  const stageKey = safeText(filters.stageKey);

  return entries.filter((item) => {
    if (!isTopicDigestEntry(item)) return false;
    if (section && safeText(item.section) !== section) return false;
    if (entryType && safeText(item.entry_type) !== entryType) return false;
    if (moduleKey && safeText(item.module_key) !== moduleKey) return false;
    if (stageKey && safeText(item.stage_key) !== stageKey) return false;
    return true;
  });
}

export class ProjectMemoryTopicDigestReader {
  constructor({ service }) {
    this.service = service;
  }

  async listEntries({
    projectKey,
    section = null,
    entryType = null,
    moduleKey = null,
    stageKey = null,
    limit = 20,
  } = {}) {
    const targetLimit = normalizeLimit(limit, 20, 1, 100);

    const rawEntries = await this.service.listEntries(projectKey, {
      layer: "topic_digest",
      isActive: true,
      limit: Math.max(100, targetLimit),
    });

    const filtered = applyTopicDigestFilters(rawEntries, {
      section,
      entryType,
      moduleKey,
      stageKey,
    });

    return filtered
      .slice(0, targetLimit)
      .map((item) => withDerivedTopicDigestFields(item));
  }

  async buildContext({
    projectKey,
    section = null,
    entryType = null,
    moduleKey = null,
    stageKey = null,
    limit = 10,
    maxCharsPerEntry = 900,
    maxTotalChars = 3500,
  } = {}) {
    const entries = await this.listEntries({
      projectKey,
      section,
      entryType,
      moduleKey,
      stageKey,
      limit,
    });

    if (!entries.length) return "";

    const lines = [
      "PROJECT TOPIC DIGEST CONTEXT (SOFT SUMMARY, NOT CONFIRMED MEMORY):",
      "Use only as a compressed orientation layer.",
      "Do not treat as proof of current runtime implementation state.",
      "Do not let topic digest override confirmed memory.",
      "",
    ];

    for (const item of entries) {
      const title = item.title || item.section || item.entry_type || "topic_digest";
      const header = `- ${title} [section=${item.section || "-"}, entry_type=${item.entry_type || "-"}, module=${item.module_key || "-"}, stage=${item.stage_key || "-"}]`;
      const body = compactText(item.content, maxCharsPerEntry);
      lines.push(`${header}\n${body}`);
    }

    return lines.join("\n\n").slice(0, maxTotalChars);
  }

  async buildDigest({
    projectKey,
    section = null,
    entryType = null,
    moduleKey = null,
    stageKey = null,
    limit = 50,
  } = {}) {
    const entries = await this.listEntries({
      projectKey,
      section,
      entryType,
      moduleKey,
      stageKey,
      limit,
    });

    const sections = new Set();
    const entryTypes = new Set();
    const moduleKeys = new Set();
    const stageKeys = new Set();

    for (const item of entries) {
      if (item.section) sections.add(item.section);
      if (item.entry_type) entryTypes.add(item.entry_type);
      if (item.module_key) moduleKeys.add(item.module_key);
      if (item.stage_key) stageKeys.add(item.stage_key);
    }

    return {
      totalEntries: entries.length,
      sections: Array.from(sections).sort(),
      entryTypes: Array.from(entryTypes).sort(),
      moduleKeys: Array.from(moduleKeys).sort(),
      stageKeys: Array.from(stageKeys).sort(),
      warning: "Topic digest is soft summary only and must not replace confirmed memory.",
      filters: {
        section: section || null,
        entryType: entryType || null,
        moduleKey: moduleKey || null,
        stageKey: stageKey || null,
      },
    };
  }
}

export default ProjectMemoryTopicDigestReader;
