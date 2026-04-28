// src/projectExperience/PillarsResolver.js
// ============================================================================
// Pillars Resolver
// Read-only universal resolver for pillars/ source structure.
// Purpose:
// - Do not depend on hardcoded ROADMAP.md / WORKFLOW.md flat files.
// - Support folders, files, added/removed/archived sections.
// - Keep archive/old/unused/deprecated materials out of active context by default.
// - Never edit pillars; read-only only.
// ============================================================================

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACTIVE_SECTION_ALIASES = Object.freeze({
  roadmap: ["roadmap", "roadmaps", "plan", "plans", "дорожная", "дорожня"],
  workflow: ["workflow", "workflows", "process", "processes", "flow", "rules", "порядок", "процесс", "процес"],
  decisions: ["decisions", "decision", "adr", "records", "решения", "рішення"],
  project: ["project", "overview", "readme", "about", "core", "проект", "проєкт"],
  architecture: ["architecture", "architectural", "module", "modules", "map", "архитектура", "архітектура"],
});

const ARCHIVE_MARKERS = Object.freeze([
  "archive",
  "archived",
  "old",
  "unused",
  "deprecated",
  "backup",
  "bak",
  "legacy",
  "архив",
  "архів",
  "стар",
]);

function repoRootDir() {
  return path.resolve(__dirname, "..", "..");
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeKey(value) {
  return normalizeString(value).toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/gi, "_").replace(/^_+|_+$/g, "");
}

function toPosix(value) {
  return normalizeString(value).replace(/\\/g, "/");
}

function isMarkdownFile(filePath = "") {
  return /\.md$/i.test(String(filePath || ""));
}

function pathLooksArchived(relPath = "") {
  const parts = toPosix(relPath).toLowerCase().split("/").filter(Boolean);
  return parts.some((part) => ARCHIVE_MARKERS.some((marker) => part.includes(marker)));
}

function inferSectionFromPath(relPath = "") {
  const normalized = toPosix(relPath).toLowerCase();
  const parts = normalized.split("/").filter(Boolean);
  const fileName = parts[parts.length - 1] || "";
  const baseName = fileName.replace(/\.md$/i, "");
  const candidates = [...parts, baseName].map(normalizeKey).filter(Boolean);

  for (const [section, aliases] of Object.entries(ACTIVE_SECTION_ALIASES)) {
    const normalizedAliases = aliases.map(normalizeKey);
    if (candidates.some((candidate) => normalizedAliases.some((alias) => candidate === alias || candidate.includes(alias)))) {
      return section;
    }
  }

  return "misc";
}

async function pathExists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

async function readFileIfExists(absPath) {
  try {
    const text = await fs.readFile(absPath, "utf-8");
    return String(text ?? "").trim();
  } catch {
    return "";
  }
}

async function walkMarkdownFiles(absDir, relDir = "") {
  const results = [];

  let entries = [];
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return results;
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const relPath = toPosix(path.join(relDir, entry.name));
    const absPath = path.join(absDir, entry.name);

    if (entry.isDirectory()) {
      results.push(...await walkMarkdownFiles(absPath, relPath));
      continue;
    }

    if (entry.isFile() && isMarkdownFile(entry.name)) {
      results.push({ absPath, relPath });
    }
  }

  return results;
}

function buildCombinedContent(section, sources = []) {
  const activeSources = sources.filter((source) => source.status === "active" && source.content);
  if (!activeSources.length) return "";

  return activeSources.map((source) => {
    return [
      `# ${section.toUpperCase()} SOURCE: ${source.relPath}`,
      "",
      source.content,
    ].join("\n");
  }).join("\n\n---\n\n").trim();
}

function sectionTitle(section) {
  return String(section || "misc").toUpperCase();
}

export class PillarsResolver {
  constructor({ rootDir = repoRootDir(), pillarsDir = "pillars" } = {}) {
    this.rootDir = rootDir;
    this.pillarsDir = pillarsDir;
  }

  async resolve() {
    const absPillarsDir = path.join(this.rootDir, this.pillarsDir);
    const exists = await pathExists(absPillarsDir);

    if (!exists) {
      return {
        ok: false,
        rootDir: this.rootDir,
        pillarsDir: this.pillarsDir,
        sections: [],
        reason: "pillars_dir_missing",
      };
    }

    const markdownFiles = await walkMarkdownFiles(absPillarsDir, this.pillarsDir);
    const bySection = new Map();

    for (const file of markdownFiles) {
      const relPath = toPosix(file.relPath);
      const status = pathLooksArchived(relPath) ? "archived" : "active";
      const section = inferSectionFromPath(relPath);
      const content = await readFileIfExists(file.absPath);

      if (!bySection.has(section)) bySection.set(section, []);
      bySection.get(section).push({
        section,
        relPath,
        absPath: file.absPath,
        status,
        content,
        bytes: content.length,
      });
    }

    const sections = [...bySection.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([section, sources]) => {
        const activeSources = sources.filter((source) => source.status === "active" && source.content);
        const archivedSources = sources.filter((source) => source.status === "archived");
        const content = buildCombinedContent(section, sources);

        return {
          section,
          title: sectionTitle(section),
          content,
          tags: [section, "canonical", "pillars_resolved"],
          sourceRef: activeSources.map((source) => source.relPath).join(", ") || `${this.pillarsDir}/${section}/`,
          relatedPaths: activeSources.map((source) => source.relPath),
          activeFiles: activeSources.length,
          archivedFiles: archivedSources.length,
          totalFiles: sources.length,
          status: activeSources.length > 0 ? "active" : "missing_or_archived_only",
          sources: sources.map((source) => ({
            relPath: source.relPath,
            status: source.status,
            bytes: source.bytes,
          })),
        };
      });

    return {
      ok: true,
      rootDir: this.rootDir,
      pillarsDir: this.pillarsDir,
      sections,
      totalMarkdownFiles: markdownFiles.length,
      activeMarkdownFiles: sections.reduce((sum, section) => sum + section.activeFiles, 0),
      archivedMarkdownFiles: sections.reduce((sum, section) => sum + section.archivedFiles, 0),
    };
  }

  async resolveSection(sectionKey) {
    const resolved = await this.resolve();
    const key = normalizeKey(sectionKey);
    const section = resolved.sections?.find((item) => normalizeKey(item.section) === key) || null;
    return section;
  }
}

export async function resolvePillars(options = {}) {
  const resolver = new PillarsResolver(options);
  return resolver.resolve();
}

export default PillarsResolver;
