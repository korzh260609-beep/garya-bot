// src/projectMemory/ProjectMemoryConfirmedUpdater.js
// ============================================================================
// Project Memory Confirmed Updater
// Purpose:
// - universal update use-cases for confirmed project memory
// - transport-agnostic
// - no Telegram/Discord/Web assumptions
// - update curated confirmed entries by id
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeMeta(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function parseBooleanLike(value, def = undefined) {
  if (typeof value === "boolean") return value;

  const s = safeText(value).toLowerCase();
  if (!s) return def;

  if (["1", "true", "yes", "y", "on", "enabled"].includes(s)) return true;
  if (["0", "false", "no", "n", "off", "disabled"].includes(s)) return false;

  return def;
}

function normalizePatch(patch = {}) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error("ProjectMemoryConfirmedUpdater.updateEntry: patch object is required");
  }

  const out = {};

  if (Object.prototype.hasOwnProperty.call(patch, "title")) {
    out.title = safeText(patch.title) || null;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "content")) {
    out.content = safeText(patch.content);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "tags")) {
    out.tags = ensureArray(patch.tags).map(safeText).filter(Boolean);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "relatedPaths")) {
    out.relatedPaths = ensureArray(patch.relatedPaths).map(safeText).filter(Boolean);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "moduleKey")) {
    out.moduleKey = safeText(patch.moduleKey) || null;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "stageKey")) {
    out.stageKey = safeText(patch.stageKey) || null;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "sourceType")) {
    out.sourceType = safeText(patch.sourceType) || null;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "sourceRef")) {
    out.sourceRef = safeText(patch.sourceRef) || null;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "status")) {
    out.status = safeText(patch.status) || null;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "confidence")) {
    out.confidence = patch.confidence;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "isActive")) {
    out.isActive = patch.isActive;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "meta")) {
    out.meta = normalizeMeta(patch.meta);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "aiContext")) {
    out.aiContext = parseBooleanLike(patch.aiContext, undefined);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "projectArea")) {
    out.projectArea = patch.projectArea;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "repoScope")) {
    out.repoScope = patch.repoScope;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "linkedAreas")) {
    out.linkedAreas = ensureArray(patch.linkedAreas);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "linkedRepoScopes")) {
    out.linkedRepoScopes = ensureArray(patch.linkedRepoScopes);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "crossRepo")) {
    out.crossRepo = parseBooleanLike(patch.crossRepo, undefined);
  }

  return out;
}

export class ProjectMemoryConfirmedUpdater {
  constructor({ service }) {
    this.service = service;
  }

  async updateEntry({
    id,
    projectKey,
    patch = {},
  } = {}) {
    const resolvedId = Number(id);

    if (!Number.isInteger(resolvedId) || resolvedId <= 0) {
      throw new Error("ProjectMemoryConfirmedUpdater.updateEntry: valid id is required");
    }

    const normalizedPatch = normalizePatch(patch);

    if (!Object.keys(normalizedPatch).length) {
      throw new Error("ProjectMemoryConfirmedUpdater.updateEntry: patch is empty");
    }

    return this.service.updateConfirmedEntryById({
      id: resolvedId,
      projectKey,
      patch: normalizedPatch,
    });
  }
}

export default ProjectMemoryConfirmedUpdater;