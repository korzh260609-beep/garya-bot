// src/projectMemory/ProjectMemorySourceSync.js
// ============================================================================
// Project Memory Source Sync
// Purpose:
// - seed / refresh project memory from canonical source files
// - universal logic: repo files, docs, future web/admin UI sources
// - no overwrite unless explicitly allowed
// ============================================================================

import path from "path";
import { fileURLToPath } from "url";
import { PillarsResolver } from "../projectExperience/PillarsResolver.js";
import { getLegacyPillarPath } from "../projectExperience/PillarTargetResolver.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function rootDir() {
  return path.resolve(__dirname, "..", "..");
}

function normalizeString(value) {
  return String(value || "").trim();
}

function legacyFallbackItems() {
  const roadmapLegacyPath = getLegacyPillarPath("roadmap");
  const workflowLegacyPath = getLegacyPillarPath("workflow");

  return [
    {
      section: "roadmap",
      title: "ROADMAP",
      relPath: roadmapLegacyPath,
      tags: ["roadmap", "canonical", "legacy_path"],
      sourceRef: roadmapLegacyPath,
    },
    {
      section: "workflow",
      title: "WORKFLOW",
      relPath: workflowLegacyPath,
      tags: ["workflow", "canonical", "legacy_path"],
      sourceRef: workflowLegacyPath,
    },
    {
      section: "decisions",
      title: "DECISIONS",
      relPath: "pillars/DECISIONS.md",
      tags: ["decisions", "canonical", "legacy_path"],
      sourceRef: "pillars/DECISIONS.md",
    },
    {
      section: "project",
      title: "PROJECT",
      relPath: "pillars/PROJECT.md",
      tags: ["project", "canonical", "legacy_path"],
      sourceRef: "pillars/PROJECT.md",
    },
  ].filter((item) => item.relPath);
}

async function buildResolvedPillarItems({ root, sources }) {
  if (Array.isArray(sources) && sources.length) {
    return sources.map((source) => ({
      ...source,
      resolverStatus: "external_sources_override",
    }));
  }

  const resolver = new PillarsResolver({ rootDir: root });
  const resolved = await resolver.resolve();

  if (!resolved?.ok) {
    return legacyFallbackItems().map((item) => ({
      ...item,
      resolverStatus: resolved?.reason || "resolver_failed",
    }));
  }

  const activeSections = (resolved.sections || [])
    .filter((section) => normalizeString(section.content))
    .map((section) => ({
      section: section.section,
      title: section.title,
      content: section.content,
      tags: section.tags || [section.section, "canonical", "pillars_resolved"],
      sourceRef: section.sourceRef,
      relatedPaths: section.relatedPaths || [],
      resolverStatus: section.status,
      resolverSources: section.sources || [],
    }));

  if (activeSections.length) return activeSections;

  return legacyFallbackItems().map((item) => ({
    ...item,
    resolverStatus: "no_active_resolved_sections",
  }));
}

export class ProjectMemorySourceSync {
  constructor({ service }) {
    this.service = service;
  }

  async syncCanonicalSections({
    projectKey,
    overwrite = false,
    sources = null,
  } = {}) {
    const root = rootDir();
    const items = await buildResolvedPillarItems({ root, sources });
    const results = [];

    for (const item of items) {
      const content = normalizeString(item.content);

      if (!content) {
        results.push({
          section: item.section,
          synced: false,
          reason: "resolved_section_missing_or_empty",
          file: item.relPath ? path.join(root, item.relPath) : null,
          sourceRef: item.sourceRef || null,
          resolverStatus: item.resolverStatus || null,
        });
        continue;
      }

      const existing = await this.service.getLatestSection(projectKey, item.section);

      if (existing && String(existing.content || "").trim() && !overwrite) {
        results.push({
          section: item.section,
          synced: false,
          reason: "already_exists",
          sourceRef: item.sourceRef || null,
          resolverStatus: item.resolverStatus || null,
        });
        continue;
      }

      await this.service.upsertSectionState({
        projectKey,
        section: item.section,
        title: item.title || String(item.section || "section").toUpperCase(),
        content,
        tags: item.tags || [],
        meta: {
          source: "pillars_resolver",
          syncMode: overwrite ? "overwrite" : "seed_if_missing",
          resolverStatus: item.resolverStatus || null,
          resolverSources: item.resolverSources || [],
        },
        schemaVersion: 3,
        entryType: "section_state",
        status: "active",
        sourceType: "pillars_resolver",
        sourceRef: item.sourceRef || item.relPath || item.section,
        relatedPaths: item.relatedPaths || (item.relPath ? [item.relPath] : []),
        moduleKey: "project_memory",
        stageKey: "7A",
        confidence: 0.95,
        isActive: true,
      });

      results.push({
        section: item.section,
        synced: true,
        sourceRef: item.sourceRef || null,
        resolverStatus: item.resolverStatus || null,
        relatedPaths: item.relatedPaths || [],
      });
    }

    return { ok: true, results };
  }
}

export default ProjectMemorySourceSync;
