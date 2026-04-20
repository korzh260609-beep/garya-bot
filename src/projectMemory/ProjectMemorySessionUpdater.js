// src/projectMemory/ProjectMemorySessionUpdater.js
// ============================================================================
// Project Memory Session Updater
// Purpose:
// - update work-session summaries in a transport-agnostic way
// - keep update rules centralized outside transport handlers
// - preserve consistent session_summary format through service layer
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function normalizeStringArrayOrUndefined(value) {
  if (!Array.isArray(value)) return undefined;
  return ensureArray(value).map(safeText).filter(Boolean);
}

function normalizePatch(patch = {}) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error("ProjectMemorySessionUpdater.updateSession: patch object is required");
  }

  const out = {};

  if (hasOwn(patch, "title")) out.title = safeText(patch.title) || null;
  if (hasOwn(patch, "content")) out.content = safeText(patch.content);

  if (hasOwn(patch, "goal")) out.goal = safeText(patch.goal);
  if (hasOwn(patch, "checked")) out.checked = normalizeStringArrayOrUndefined(patch.checked);
  if (hasOwn(patch, "changed")) out.changed = normalizeStringArrayOrUndefined(patch.changed);
  if (hasOwn(patch, "decisions")) out.decisions = normalizeStringArrayOrUndefined(patch.decisions);
  if (hasOwn(patch, "risks")) out.risks = normalizeStringArrayOrUndefined(patch.risks);
  if (hasOwn(patch, "nextSteps")) out.nextSteps = normalizeStringArrayOrUndefined(patch.nextSteps);
  if (hasOwn(patch, "notes")) out.notes = normalizeStringArrayOrUndefined(patch.notes);

  if (hasOwn(patch, "tags")) out.tags = normalizeStringArrayOrUndefined(patch.tags) || [];
  if (hasOwn(patch, "relatedPaths")) {
    out.relatedPaths = normalizeStringArrayOrUndefined(patch.relatedPaths) || [];
  }

  if (hasOwn(patch, "meta")) {
    out.meta =
      patch.meta && typeof patch.meta === "object" && !Array.isArray(patch.meta)
        ? patch.meta
        : {};
  }

  if (hasOwn(patch, "sourceType")) out.sourceType = safeText(patch.sourceType);
  if (hasOwn(patch, "sourceRef")) out.sourceRef = safeText(patch.sourceRef) || null;
  if (hasOwn(patch, "moduleKey")) out.moduleKey = safeText(patch.moduleKey) || null;
  if (hasOwn(patch, "stageKey")) out.stageKey = safeText(patch.stageKey) || null;
  if (hasOwn(patch, "status")) out.status = safeText(patch.status);
  if (hasOwn(patch, "confidence")) out.confidence = patch.confidence;
  if (hasOwn(patch, "isActive")) out.isActive = patch.isActive;

  return out;
}

export class ProjectMemorySessionUpdater {
  constructor({ service }) {
    this.service = service;
  }

  async updateSession({
    id,
    projectKey,
    section = "work_sessions",
    patch = {},
  } = {}) {
    const resolvedId = Number(id);

    if (!Number.isInteger(resolvedId) || resolvedId <= 0) {
      throw new Error("ProjectMemorySessionUpdater.updateSession: valid id is required");
    }

    const normalizedPatch = normalizePatch(patch);

    if (!Object.keys(normalizedPatch).length) {
      throw new Error("ProjectMemorySessionUpdater.updateSession: patch is empty");
    }

    return this.service.updateSessionSummaryById({
      id: resolvedId,
      projectKey,
      section,
      patch: normalizedPatch,
    });
  }
}

export default ProjectMemorySessionUpdater;