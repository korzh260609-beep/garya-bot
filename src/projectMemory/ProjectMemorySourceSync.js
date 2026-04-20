// src/projectMemory/ProjectMemorySourceSync.js
// ============================================================================
// Project Memory Source Sync
// Purpose:
// - seed / refresh project memory from canonical source files
// - universal logic: repo files, docs, future web/admin UI sources
// - no overwrite unless explicitly allowed
// ============================================================================

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function rootDir() {
  return path.resolve(__dirname, "..", "..");
}

async function readFileIfExists(absPath) {
  try {
    const text = await fs.readFile(absPath, "utf-8");
    return String(text ?? "").trim();
  } catch {
    return "";
  }
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

    const items =
      Array.isArray(sources) && sources.length
        ? sources
        : [
            {
              section: "roadmap",
              title: "ROADMAP",
              relPath: "pillars/ROADMAP.md",
              tags: ["roadmap", "canonical"],
              sourceRef: "pillars/ROADMAP.md",
            },
            {
              section: "workflow",
              title: "WORKFLOW",
              relPath: "pillars/WORKFLOW.md",
              tags: ["workflow", "canonical"],
              sourceRef: "pillars/WORKFLOW.md",
            },
            {
              section: "decisions",
              title: "DECISIONS",
              relPath: "pillars/DECISIONS.md",
              tags: ["decisions", "canonical"],
              sourceRef: "pillars/DECISIONS.md",
            },
            {
              section: "project",
              title: "PROJECT",
              relPath: "pillars/PROJECT.md",
              tags: ["project", "canonical"],
              sourceRef: "pillars/PROJECT.md",
            },
          ];

    const results = [];

    for (const item of items) {
      const absPath = path.join(root, item.relPath);
      const content = await readFileIfExists(absPath);

      if (!content) {
        results.push({
          section: item.section,
          synced: false,
          reason: "file_missing_or_empty",
          file: absPath,
        });
        continue;
      }

      const existing = await this.service.getLatestSection(projectKey, item.section);

      if (existing && String(existing.content || "").trim() && !overwrite) {
        results.push({
          section: item.section,
          synced: false,
          reason: "already_exists",
          file: absPath,
        });
        continue;
      }

      await this.service.upsertSectionState({
        projectKey,
        section: item.section,
        title: item.title,
        content,
        tags: item.tags || [],
        meta: {
          source: "repo_file",
          file: absPath,
          syncMode: overwrite ? "overwrite" : "seed_if_missing",
        },
        schemaVersion: 2,
        entryType: "section_state",
        status: "active",
        sourceType: "repo_file",
        sourceRef: item.sourceRef,
        relatedPaths: [item.relPath],
        moduleKey: "project_memory",
        stageKey: "7A",
        confidence: 0.95,
        isActive: true,
      });

      results.push({
        section: item.section,
        synced: true,
        file: absPath,
      });
    }

    return { ok: true, results };
  }
}

export default ProjectMemorySourceSync;