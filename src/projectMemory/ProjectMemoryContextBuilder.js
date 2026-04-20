// src/projectMemory/ProjectMemoryContextBuilder.js
// ============================================================================
// Project Memory Context Builder
// Purpose:
// - build universal AI context from structured project memory
// - avoid transport-specific assumptions
// - avoid hard coupling to exact phrases/templates
// ============================================================================

function safeText(value) {
  return String(value ?? "");
}

function compactText(text, maxChars = 1200) {
  const s = safeText(text).trim();
  if (!s) return "";
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + "\n...[TRUNCATED]...";
}

export class ProjectMemoryContextBuilder {
  constructor({ service }) {
    this.service = service;
  }

  async buildSoftContext({ projectKey } = {}) {
    const blocks = [];

    const sectionStateCandidates = await this.service.listEntries(projectKey, {
      entryType: "section_state",
      isActive: true,
      limit: 50,
    });

    const decisions = await this.service.listEntries(projectKey, {
      entryType: "decision",
      isActive: true,
      limit: 20,
    });

    const constraints = await this.service.listEntries(projectKey, {
      entryType: "constraint",
      isActive: true,
      limit: 20,
    });

    const nextSteps = await this.service.listEntries(projectKey, {
      entryType: "next_step",
      isActive: true,
      limit: 20,
    });

    if (sectionStateCandidates.length) {
      const lines = [];
      for (const item of sectionStateCandidates.slice(0, 8)) {
        const title = item.title || item.section;
        const body = compactText(item.content, 500);
        lines.push(`- ${title}\n${body}`);
      }
      if (lines.length) {
        blocks.push(["SECTION STATE:", ...lines].join("\n"));
      }
    }

    if (decisions.length) {
      const lines = [];
      for (const item of decisions.slice(0, 8)) {
        const title = item.title || item.section || "decision";
        const body = compactText(item.content, 400);
        lines.push(`- ${title}\n${body}`);
      }
      if (lines.length) {
        blocks.push(["DECISIONS:", ...lines].join("\n"));
      }
    }

    if (constraints.length) {
      const lines = [];
      for (const item of constraints.slice(0, 8)) {
        const body = compactText(item.content, 300);
        lines.push(`- ${body}`);
      }
      if (lines.length) {
        blocks.push(["CONSTRAINTS:", ...lines].join("\n"));
      }
    }

    if (nextSteps.length) {
      const lines = [];
      for (const item of nextSteps.slice(0, 8)) {
        const body = compactText(item.content, 300);
        lines.push(`- ${body}`);
      }
      if (lines.length) {
        blocks.push(["NEXT STEPS:", ...lines].join("\n"));
      }
    }

    if (!blocks.length) return "";

    return [
      "PROJECT BACKGROUND CONTEXT (SOFT MEMORY, NOT RUNTIME PROOF):",
      "Use as context, not as proof of current runtime implementation.",
      "",
      blocks.join("\n\n"),
    ]
      .join("\n")
      .slice(0, 4000);
  }

  async buildProjectDigest({ projectKey } = {}) {
    const entries = await this.service.listEntries(projectKey, {
      isActive: true,
      limit: 200,
    });

    const entryTypes = new Set();
    const moduleKeys = new Set();
    const stageKeys = new Set();
    const relatedPaths = new Set();
    const sections = new Set();

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
    };
  }
}

export default ProjectMemoryContextBuilder;