// src/bootstrap/projectMemoryAutoRestore.js
// STAGE 7A.4 — project auto-restore (seed ROADMAP/WORKFLOW into project_memory)
// Policy:
// - Seed ONLY if DB sections are missing.
// - Read from repo files: pillars/ROADMAP.md and pillars/WORKFLOW.md
// - Never overwrite existing DB content.

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { getProjectSection, upsertProjectSection } from "../../projectMemory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function _rootDir() {
  // src/bootstrap -> project root
  return path.resolve(__dirname, "..", "..");
}

async function _readFileIfExists(absPath) {
  try {
    const s = await fs.readFile(absPath, "utf-8");
    return String(s ?? "").trim();
  } catch (_) {
    return "";
  }
}

async function _seedOne({ section, title, absPath, tag }) {
  const existing = await getProjectSection(undefined, section);
  if (existing && String(existing.content || "").trim()) {
    return { section, seeded: false, reason: "already_exists" };
  }

  const content = await _readFileIfExists(absPath);
  if (!content) {
    return { section, seeded: false, reason: "file_missing_or_empty", file: absPath };
  }

  await upsertProjectSection({
    section,
    title,
    content,
    tags: [tag, "auto_restore"],
    meta: { source: "file", file: absPath },
    schemaVersion: 1,
  });

  return { section, seeded: true, file: absPath };
}

export async function autoRestoreProjectMemory({ enabled = true } = {}) {
  if (!enabled) return { ok: true, skipped: true, reason: "disabled" };

  const root = _rootDir();

  const roadmapPath = path.join(root, "pillars", "ROADMAP.md");
  const workflowPath = path.join(root, "pillars", "WORKFLOW.md");

  const results = [];
  results.push(
    await _seedOne({
      section: "roadmap",
      title: "ROADMAP",
      absPath: roadmapPath,
      tag: "roadmap",
    })
  );

  results.push(
    await _seedOne({
      section: "workflow",
      title: "WORKFLOW",
      absPath: workflowPath,
      tag: "workflow",
    })
  );

  return { ok: true, results };
}

export default autoRestoreProjectMemory;