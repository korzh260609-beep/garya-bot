// src/projectMemory/ProjectMemorySessionRecorder.js
// ============================================================================
// Project Memory Session Recorder
// Purpose:
// - record work-session summaries in a transport-agnostic way
// - preserve "what / why / risks / next" as structured project memory
// - no dependency on Telegram-specific wording
// - use shared canonical session_summary formatter
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
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
    const normalizedGoal = safeText(goal);
    const normalizedChecked = ensureArray(checked).map(safeText).filter(Boolean);
    const normalizedChanged = ensureArray(changed).map(safeText).filter(Boolean);
    const normalizedDecisions = ensureArray(decisions).map(safeText).filter(Boolean);
    const normalizedRisks = ensureArray(risks).map(safeText).filter(Boolean);
    const normalizedNextSteps = ensureArray(nextSteps).map(safeText).filter(Boolean);
    const normalizedNotes = ensureArray(notes).map(safeText).filter(Boolean);

    if (!normalizedGoal) {
      throw new Error("ProjectMemorySessionRecorder.recordSession: goal is required");
    }

    return this.service.appendSessionSummary({
      projectKey,
      section: "work_sessions",
      title: safeText(title) || null,
      goal: normalizedGoal,
      checked: normalizedChecked,
      changed: normalizedChanged,
      decisions: normalizedDecisions,
      risks: normalizedRisks,
      nextSteps: normalizedNextSteps,
      notes: normalizedNotes,
      tags: ensureArray(tags).map(safeText).filter(Boolean),
      meta: meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {},
      sourceType: safeText(sourceType) || "chat_session",
      sourceRef: safeText(sourceRef) || null,
      relatedPaths: ensureArray(relatedPaths).map(safeText).filter(Boolean),
      moduleKey: safeText(moduleKey) || null,
      stageKey: safeText(stageKey) || null,
      confidence: 0.85,
    });
  }
}

export default ProjectMemorySessionRecorder;