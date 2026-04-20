// src/projectMemory/ProjectMemorySessionRecorder.js
// ============================================================================
// Project Memory Session Recorder
// Purpose:
// - record work-session summaries in a transport-agnostic way
// - preserve "what / why / risks / next" as structured project memory
// - no dependency on Telegram-specific wording
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildSessionContent({
  goal,
  checked = [],
  changed = [],
  decisions = [],
  risks = [],
  nextSteps = [],
  notes = [],
}) {
  const lines = [];

  if (goal) {
    lines.push("GOAL:");
    lines.push(goal);
    lines.push("");
  }

  if (checked.length) {
    lines.push("CHECKED:");
    checked.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }

  if (changed.length) {
    lines.push("CHANGED:");
    changed.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }

  if (decisions.length) {
    lines.push("DECISIONS:");
    decisions.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }

  if (risks.length) {
    lines.push("RISKS:");
    risks.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }

  if (nextSteps.length) {
    lines.push("NEXT:");
    nextSteps.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }

  if (notes.length) {
    lines.push("NOTES:");
    notes.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }

  return lines.join("\n").trim();
}

export class ProjectMemorySessionRecorder {
  constructor({ service }) {
    this.service = service;
  }

  async recordSession({
    projectKey,
    title = null,
    goal = "",
    checked = [],
    changed = [],
    decisions = [],
    risks = [],
    nextSteps = [],
    notes = [],
    tags = [],
    sourceType = "chat_session",
    sourceRef = null,
    relatedPaths = [],
    moduleKey = null,
    stageKey = null,
    meta = {},
  } = {}) {
    const content = buildSessionContent({
      goal: safeText(goal),
      checked: ensureArray(checked).map(safeText).filter(Boolean),
      changed: ensureArray(changed).map(safeText).filter(Boolean),
      decisions: ensureArray(decisions).map(safeText).filter(Boolean),
      risks: ensureArray(risks).map(safeText).filter(Boolean),
      nextSteps: ensureArray(nextSteps).map(safeText).filter(Boolean),
      notes: ensureArray(notes).map(safeText).filter(Boolean),
    });

    if (!content) {
      throw new Error("ProjectMemorySessionRecorder.recordSession: empty content");
    }

    return this.service.appendSessionSummary({
      projectKey,
      section: "work_sessions",
      title,
      content,
      tags,
      meta,
      sourceType,
      sourceRef,
      relatedPaths,
      moduleKey,
      stageKey,
      confidence: 0.85,
    });
  }
}

export default ProjectMemorySessionRecorder;