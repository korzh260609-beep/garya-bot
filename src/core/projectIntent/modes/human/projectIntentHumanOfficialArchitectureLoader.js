// src/core/projectIntent/modes/human/projectIntentHumanOfficialArchitectureLoader.js
// ============================================================================
// HUMAN PROJECT OFFICIAL ARCHITECTURE LOADER
//
// Purpose:
// - read official architecture pillars for Human Mode context packs.
// - keep design truth separated from RepoStateAgent current-code facts.
// - fail open when files are unavailable in runtime/deploy.
//
// Hard rules:
// - no DB writes.
// - no AI calls.
// - no repo scans.
// - no keyword routing.
// - no final response generation here.
// ============================================================================

import { readFile } from "node:fs/promises";
import path from "node:path";

const OFFICIAL_ARCHITECTURE_FILES = Object.freeze([
  "pillars/architecture/SG_INTERFACE_LAYERS.md",
  "pillars/architecture/REPO_MAP_SOURCE_POLICY.md",
  "pillars/architecture/SEMANTIC_ROUTING.md",
  "pillars/architecture/HUMAN_MODE_REPOSTATEAGENT_SKELETON.md",
]);

function getProjectRoot() {
  return process.cwd();
}

async function readArchitectureFile(relativePath) {
  try {
    const absolutePath = path.join(getProjectRoot(), relativePath);
    const content = await readFile(absolutePath, "utf-8");

    return {
      path: relativePath,
      available: true,
      content,
      error: null,
    };
  } catch (e) {
    return {
      path: relativePath,
      available: false,
      content: null,
      error: e?.code || e?.message || "read_failed",
    };
  }
}

export async function loadHumanProjectOfficialArchitecture() {
  const files = await Promise.all(
    OFFICIAL_ARCHITECTURE_FILES.map((filePath) => readArchitectureFile(filePath))
  );

  const availableFiles = files.filter((file) => file.available === true);

  return {
    available: availableFiles.length > 0,
    source: "pillars.architecture.filesystem_read_only",
    root: getProjectRoot(),
    files,
    loadedCount: availableFiles.length,
    expectedCount: OFFICIAL_ARCHITECTURE_FILES.length,
    readOnly: true,
    tokensSpent: false,
  };
}

export default {
  loadHumanProjectOfficialArchitecture,
};
