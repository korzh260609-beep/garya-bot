// src/projectExperience/PillarTargetResolver.js
// ============================================================================
// Pillar Target Resolver
// Purpose:
// - centralize canonical pillar target paths
// - stop scattering old flat WORKFLOW.md / ROADMAP.md assumptions
// - keep legacy flat files as compatibility fallbacks only
// - no filesystem access, no side effects
// ============================================================================

export const PILLAR_TARGETS = Object.freeze({
  workflow: Object.freeze({
    key: "workflow",
    kind: "section",
    preferredPath: "pillars/workflow/",
    legacyPath: "pillars/WORKFLOW.md",
    indexPath: "pillars/workflow/README.md",
    activePaths: Object.freeze([
      "pillars/workflow/README.md",
      "pillars/workflow/00_RULES_AND_ORDER.md",
      "pillars/workflow/01_STAGE_01_06_CORE.md",
      "pillars/workflow/02_STAGE_07_MEMORY.md",
      "pillars/workflow/03_STAGE_08_12_FOUNDATION.md",
      "pillars/workflow/04_STAGE_13_20_ADVANCED.md",
    ]),
  }),

  roadmap: Object.freeze({
    key: "roadmap",
    kind: "section",
    preferredPath: "pillars/roadmap/",
    legacyPath: "pillars/ROADMAP.md",
    indexPath: "pillars/roadmap/README.md",
    activePaths: Object.freeze([
      "pillars/roadmap/README.md",
      "pillars/roadmap/00_RULES_AND_ORDER.md",
      "pillars/roadmap/01_STAGE_01_06_CORE.md",
      "pillars/roadmap/02_STAGE_07_MEMORY.md",
      "pillars/roadmap/03_STAGE_08_12_FOUNDATION.md",
      "pillars/roadmap/04_STAGE_13_20_ADVANCED.md",
    ]),
  }),

  decisions: Object.freeze({
    key: "decisions",
    kind: "file",
    preferredPath: "pillars/DECISIONS.md",
    legacyPath: "pillars/DECISIONS.md",
    indexPath: "pillars/DECISIONS.md",
    activePaths: Object.freeze(["pillars/DECISIONS.md"]),
  }),

  project: Object.freeze({
    key: "project",
    kind: "file",
    preferredPath: "pillars/PROJECT.md",
    legacyPath: "pillars/PROJECT.md",
    indexPath: "pillars/PROJECT.md",
    activePaths: Object.freeze(["pillars/PROJECT.md"]),
  }),

  kingdom: Object.freeze({
    key: "kingdom",
    kind: "file",
    preferredPath: "pillars/KINGDOM.md",
    legacyPath: "pillars/KINGDOM.md",
    indexPath: "pillars/KINGDOM.md",
    activePaths: Object.freeze(["pillars/KINGDOM.md"]),
  }),

  sg_behavior: Object.freeze({
    key: "sg_behavior",
    kind: "file",
    preferredPath: "pillars/SG_BEHAVIOR.md",
    legacyPath: "pillars/SG_BEHAVIOR.md",
    indexPath: "pillars/SG_BEHAVIOR.md",
    activePaths: Object.freeze(["pillars/SG_BEHAVIOR.md"]),
  }),

  sg_entity: Object.freeze({
    key: "sg_entity",
    kind: "file",
    preferredPath: "pillars/SG_ENTITY.md",
    legacyPath: "pillars/SG_ENTITY.md",
    indexPath: "pillars/SG_ENTITY.md",
    activePaths: Object.freeze(["pillars/SG_ENTITY.md"]),
  }),

  repoindex: Object.freeze({
    key: "repoindex",
    kind: "file",
    preferredPath: "pillars/REPOINDEX.md",
    legacyPath: "pillars/REPOINDEX.md",
    indexPath: "pillars/REPOINDEX.md",
    activePaths: Object.freeze(["pillars/REPOINDEX.md"]),
  }),

  code_insert_rules: Object.freeze({
    key: "code_insert_rules",
    kind: "file",
    preferredPath: "pillars/CODE_INSERT_RULES.md",
    legacyPath: "pillars/CODE_INSERT_RULES.md",
    indexPath: "pillars/CODE_INSERT_RULES.md",
    activePaths: Object.freeze(["pillars/CODE_INSERT_RULES.md"]),
  }),
});

export function normalizePillarKey(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_]+/gi, "_").replace(/^_+|_+$/g, "");
}

export function getPillarTarget(key) {
  return PILLAR_TARGETS[normalizePillarKey(key)] || null;
}

export function getPreferredPillarPath(key) {
  return getPillarTarget(key)?.preferredPath || "";
}

export function getLegacyPillarPath(key) {
  return getPillarTarget(key)?.legacyPath || "";
}

export function getPillarIndexPath(key) {
  return getPillarTarget(key)?.indexPath || "";
}

export function getActivePillarPaths(key) {
  return [...(getPillarTarget(key)?.activePaths || [])];
}

export function getPillarTargetFromBasename(value = "") {
  const key = String(value || "").trim().toLowerCase();

  const basenameMap = {
    "workflow.md": "workflow",
    "roadmap.md": "roadmap",
    "decisions.md": "decisions",
    "decision.md": "decisions",
    "project.md": "project",
    "kingdom.md": "kingdom",
    "sg_behavior.md": "sg_behavior",
    "sg_entity.md": "sg_entity",
    "repoindex.md": "repoindex",
    "code_insert_rules.md": "code_insert_rules",
  };

  return getPillarTarget(basenameMap[key]);
}

export function isSplitPillarSectionPath(path = "") {
  const value = String(path || "").trim();
  return value === "pillars/workflow/" || value === "pillars/roadmap/";
}

export default {
  PILLAR_TARGETS,
  normalizePillarKey,
  getPillarTarget,
  getPreferredPillarPath,
  getLegacyPillarPath,
  getPillarIndexPath,
  getActivePillarPaths,
  getPillarTargetFromBasename,
  isSplitPillarSectionPath,
};
