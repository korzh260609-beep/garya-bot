// src/projectExperience/PillarsContextReader.js
// ============================================================================
// STAGE C.1 — Pillars Context Reader
// Purpose:
// - define a single read-only layer for project pillars context
// - keep SG aligned with roadmap / workflow / decisions / architecture
// - support universal folder/file pillars structure through PillarsResolver
// IMPORTANT:
// - READ-ONLY contract
// - NO pillar edits
// - NO DB writes
// - NO GitHub calls here; resolver reads local deployed repo files only
// ============================================================================

import {
  createProjectEvidence,
  PROJECT_EXPERIENCE_EVIDENCE_TYPES,
  PROJECT_EXPERIENCE_CONFIDENCE,
} from "./projectExperienceTypes.js";
import { PillarsResolver } from "./PillarsResolver.js";

export const PROJECT_PILLAR_FILES = Object.freeze({
  ROADMAP: "pillars/roadmap/",
  WORKFLOW: "pillars/workflow/",
  DECISIONS: "pillars/DECISIONS.md",
  PROJECT: "pillars/PROJECT.md",
  ARCHITECTURE: "pillars/architecture/",
});

function safeText(value) {
  return String(value ?? "").trim();
}

function splitLines(value = "") {
  return String(value ?? "").split(/\r?\n/);
}

function extractHeadings(content = "") {
  return splitLines(content)
    .map((line, index) => {
      const match = String(line || "").match(/^(#{1,6})\s+(.+)$/);
      if (!match) return null;

      return {
        level: match[1].length,
        title: safeText(match[2]),
        line: index + 1,
      };
    })
    .filter(Boolean);
}

function findStageMentions(content = "") {
  const mentions = [];
  const lines = splitLines(content);

  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] || "");
    const matches = line.matchAll(/(?:stage|этап|етап)\s+([0-9]+[a-zа-я]?(?:\.[0-9]+)?)/gi);

    for (const match of matches) {
      mentions.push({
        stageKey: safeText(match[1]).toUpperCase(),
        line: index + 1,
        text: safeText(line),
      });
    }
  }

  return mentions;
}

function sectionToEvidenceType(sectionKey) {
  if (sectionKey === "decisions") {
    return PROJECT_EXPERIENCE_EVIDENCE_TYPES.DECISION_ENTRY;
  }
  return PROJECT_EXPERIENCE_EVIDENCE_TYPES.WORKFLOW_ENTRY;
}

function buildPillarItem({ key, path, content }) {
  const normalizedContent = safeText(content);
  return {
    key,
    path,
    available: normalizedContent.length > 0,
    headings: extractHeadings(normalizedContent),
    stageMentions: findStageMentions(normalizedContent),
  };
}

function buildContextFromItems(items = []) {
  const pillars = items.map(buildPillarItem);

  const evidences = pillars.map((pillar) =>
    createProjectEvidence({
      type: sectionToEvidenceType(pillar.key),
      source: "pillar",
      ref: pillar.path,
      title: `Pillar: ${pillar.key}`,
      summary: pillar.available
        ? `Pillar available: ${pillar.path}; headings=${pillar.headings.length}; stageMentions=${pillar.stageMentions.length}`
        : `Pillar missing or empty: ${pillar.path}`,
      details: {
        key: pillar.key,
        path: pillar.path,
        available: pillar.available,
        headingsCount: pillar.headings.length,
        stageMentionsCount: pillar.stageMentions.length,
      },
      confidence: pillar.available
        ? PROJECT_EXPERIENCE_CONFIDENCE.HIGH
        : PROJECT_EXPERIENCE_CONFIDENCE.LOW,
    })
  );

  return {
    pillars,
    evidences,
  };
}

function findSection(resolved, key) {
  return (resolved?.sections || []).find((section) => section.section === key) || null;
}

export class PillarsContextReader {
  constructor({ pillarFiles = PROJECT_PILLAR_FILES, resolver = null } = {}) {
    this.pillarFiles = pillarFiles;
    this.resolver = resolver || new PillarsResolver();
  }

  buildPillarContext({ roadmap = "", workflow = "", decisions = "", project = "", architecture = "" } = {}) {
    const items = [
      { key: "roadmap", path: this.pillarFiles.ROADMAP, content: roadmap },
      { key: "workflow", path: this.pillarFiles.WORKFLOW, content: workflow },
      { key: "decisions", path: this.pillarFiles.DECISIONS, content: decisions },
      { key: "project", path: this.pillarFiles.PROJECT, content: project },
      { key: "architecture", path: this.pillarFiles.ARCHITECTURE, content: architecture },
    ];

    return buildContextFromItems(items);
  }

  async buildResolvedPillarContext() {
    const resolved = await this.resolver.resolve();

    if (!resolved?.ok) {
      return {
        pillars: [],
        evidences: [],
        resolver: resolved,
      };
    }

    const preferredOrder = ["project", "workflow", "roadmap", "decisions", "architecture"];
    const orderedSections = [
      ...preferredOrder.map((key) => findSection(resolved, key)).filter(Boolean),
      ...(resolved.sections || []).filter((section) => !preferredOrder.includes(section.section)),
    ];

    const items = orderedSections.map((section) => ({
      key: section.section,
      path: section.sourceRef || section.section,
      content: section.content,
    }));

    return {
      ...buildContextFromItems(items),
      resolver: {
        ok: true,
        totalMarkdownFiles: resolved.totalMarkdownFiles,
        activeMarkdownFiles: resolved.activeMarkdownFiles,
        archivedMarkdownFiles: resolved.archivedMarkdownFiles,
      },
    };
  }

  findStageContext({ stageKey, pillarContext } = {}) {
    const normalizedStageKey = safeText(stageKey).toUpperCase();
    const pillars = Array.isArray(pillarContext?.pillars) ? pillarContext.pillars : [];

    if (!normalizedStageKey) {
      return {
        stageKey: null,
        matches: [],
      };
    }

    const matches = [];

    for (const pillar of pillars) {
      const mentions = Array.isArray(pillar.stageMentions) ? pillar.stageMentions : [];

      for (const mention of mentions) {
        if (safeText(mention.stageKey).toUpperCase() !== normalizedStageKey) continue;

        matches.push({
          pillarKey: pillar.key,
          path: pillar.path,
          line: mention.line,
          text: mention.text,
        });
      }
    }

    return {
      stageKey: normalizedStageKey,
      matches,
    };
  }
}

export default {
  PROJECT_PILLAR_FILES,
  PillarsContextReader,
};
