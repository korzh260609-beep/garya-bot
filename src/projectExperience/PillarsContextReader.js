// src/projectExperience/PillarsContextReader.js
// ============================================================================
// STAGE C.1 — Pillars Context Reader (SKELETON)
// Purpose:
// - define a single read-only layer for project pillars context
// - keep SG aligned with ROADMAP / WORKFLOW / DECISIONS
// - prepare reconciliation between repo evidence, project memory and pillars
// IMPORTANT:
// - READ-ONLY contract
// - NO pillar edits
// - NO DB writes
// - NO GitHub calls here; caller supplies file contents
// ============================================================================

import {
  createProjectEvidence,
  PROJECT_EXPERIENCE_EVIDENCE_TYPES,
  PROJECT_EXPERIENCE_CONFIDENCE,
} from "./projectExperienceTypes.js";

export const PROJECT_PILLAR_FILES = Object.freeze({
  ROADMAP: "pillars/ROADMAP.md",
  WORKFLOW: "pillars/WORKFLOW.md",
  DECISIONS: "pillars/DECISIONS.md",
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
    const matches = line.matchAll(/(?:stage|этап)\s+([0-9]+[a-zа-я]?(?:\.[0-9]+)?)/gi);

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

export class PillarsContextReader {
  constructor({ pillarFiles = PROJECT_PILLAR_FILES } = {}) {
    this.pillarFiles = pillarFiles;
  }

  buildPillarContext({ roadmap = "", workflow = "", decisions = "" } = {}) {
    const items = [
      {
        key: "roadmap",
        path: this.pillarFiles.ROADMAP,
        content: roadmap,
      },
      {
        key: "workflow",
        path: this.pillarFiles.WORKFLOW,
        content: workflow,
      },
      {
        key: "decisions",
        path: this.pillarFiles.DECISIONS,
        content: decisions,
      },
    ];

    const pillars = items.map((item) => {
      const content = safeText(item.content);

      return {
        key: item.key,
        path: item.path,
        available: content.length > 0,
        headings: extractHeadings(content),
        stageMentions: findStageMentions(content),
      };
    });

    const evidences = pillars.map((pillar) =>
      createProjectEvidence({
        type:
          pillar.key === "decisions"
            ? PROJECT_EXPERIENCE_EVIDENCE_TYPES.DECISION_ENTRY
            : PROJECT_EXPERIENCE_EVIDENCE_TYPES.WORKFLOW_ENTRY,
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
