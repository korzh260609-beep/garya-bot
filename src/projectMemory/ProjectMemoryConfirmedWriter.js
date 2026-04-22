// src/projectMemory/ProjectMemoryConfirmedWriter.js
// ============================================================================
// Project Memory Confirmed Writer
// Purpose:
// - universal write use-cases for confirmed project memory
// - transport-agnostic
// - no Telegram/Discord/Web assumptions
// - write curated memory by entry semantics, not by chat phrasing
// - support one project_memory across multiple repos / project areas
// ============================================================================

import { normalizeProjectMemoryMeta } from "./projectMemoryScopes.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeMeta(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeBoolean(value, def = false) {
  if (typeof value === "boolean") return value;
  return def;
}

function withAiContext(meta, aiContext, def = false) {
  return {
    ...normalizeMeta(meta),
    aiContext: normalizeBoolean(aiContext, def),
  };
}

function normalizeCommonInput(input = {}) {
  return {
    projectKey: input.projectKey,
    title: safeText(input.title) || null,
    content: safeText(input.content),
    tags: ensureArray(input.tags).map(safeText).filter(Boolean),
    meta: normalizeMeta(input.meta),
    sourceType: safeText(input.sourceType) || "manual",
    sourceRef: safeText(input.sourceRef) || null,
    relatedPaths: ensureArray(input.relatedPaths).map(safeText).filter(Boolean),
    moduleKey: safeText(input.moduleKey) || null,
    stageKey: safeText(input.stageKey) || null,
    confidence:
      typeof input.confidence === "number" && Number.isFinite(input.confidence)
        ? input.confidence
        : 0.9,
    aiContext: input.aiContext,

    projectArea: input.projectArea,
    repoScope: input.repoScope,
    linkedAreas: input.linkedAreas,
    linkedRepoScopes: input.linkedRepoScopes,
    crossRepo: input.crossRepo,
  };
}

function buildMemoryMeta(inputMeta = {}, extra = {}, aiContext, aiContextDefault) {
  return normalizeProjectMemoryMeta(
    withAiContext(inputMeta, aiContext, aiContextDefault),
    extra
  );
}

export class ProjectMemoryConfirmedWriter {
  constructor({ service }) {
    this.service = service;
  }

  async upsertSectionState({
    projectKey,
    section,
    title = null,
    content,
    tags = [],
    meta = {},
    sourceType = "manual",
    sourceRef = null,
    relatedPaths = [],
    moduleKey = null,
    stageKey = null,
    confidence = 0.9,
    aiContext = false,

    projectArea = null,
    repoScope = null,
    linkedAreas = [],
    linkedRepoScopes = [],
    crossRepo = false,
  } = {}) {
    const resolvedSection = safeText(section);

    if (!resolvedSection) {
      throw new Error("ProjectMemoryConfirmedWriter.upsertSectionState: section is required");
    }

    return this.service.upsertSectionState({
      projectKey,
      section: resolvedSection,
      title,
      content,
      tags,
      meta: buildMemoryMeta(
        meta,
        {
          projectArea,
          repoScope,
          linkedAreas,
          linkedRepoScopes,
          crossRepo,
        },
        aiContext,
        false
      ),
      schemaVersion: 2,
      entryType: "section_state",
      status: "active",
      sourceType,
      sourceRef,
      relatedPaths,
      moduleKey,
      stageKey,
      confidence,
      isActive: true,
    });
  }

  async appendDecision(input = {}) {
    const normalized = normalizeCommonInput(input);

    return this.service.appendEntry({
      projectKey: normalized.projectKey,
      section: safeText(input.section) || "decisions",
      title: normalized.title,
      content: normalized.content,
      tags: normalized.tags,
      meta: buildMemoryMeta(
        normalized.meta,
        {
          projectArea: normalized.projectArea,
          repoScope: normalized.repoScope,
          linkedAreas: normalized.linkedAreas,
          linkedRepoScopes: normalized.linkedRepoScopes,
          crossRepo: normalized.crossRepo,
        },
        normalized.aiContext,
        true
      ),
      schemaVersion: 2,
      entryType: "decision",
      status: "active",
      sourceType: normalized.sourceType,
      sourceRef: normalized.sourceRef,
      relatedPaths: normalized.relatedPaths,
      moduleKey: normalized.moduleKey,
      stageKey: normalized.stageKey,
      confidence: normalized.confidence,
      isActive: true,
    });
  }

  async appendConstraint(input = {}) {
    const normalized = normalizeCommonInput(input);

    return this.service.appendEntry({
      projectKey: normalized.projectKey,
      section: safeText(input.section) || "constraints",
      title: normalized.title,
      content: normalized.content,
      tags: normalized.tags,
      meta: buildMemoryMeta(
        normalized.meta,
        {
          projectArea: normalized.projectArea,
          repoScope: normalized.repoScope,
          linkedAreas: normalized.linkedAreas,
          linkedRepoScopes: normalized.linkedRepoScopes,
          crossRepo: normalized.crossRepo,
        },
        normalized.aiContext,
        true
      ),
      schemaVersion: 2,
      entryType: "constraint",
      status: "active",
      sourceType: normalized.sourceType,
      sourceRef: normalized.sourceRef,
      relatedPaths: normalized.relatedPaths,
      moduleKey: normalized.moduleKey,
      stageKey: normalized.stageKey,
      confidence: normalized.confidence,
      isActive: true,
    });
  }

  async appendNextStep(input = {}) {
    const normalized = normalizeCommonInput(input);

    return this.service.appendEntry({
      projectKey: normalized.projectKey,
      section: safeText(input.section) || "next_steps",
      title: normalized.title,
      content: normalized.content,
      tags: normalized.tags,
      meta: buildMemoryMeta(
        normalized.meta,
        {
          projectArea: normalized.projectArea,
          repoScope: normalized.repoScope,
          linkedAreas: normalized.linkedAreas,
          linkedRepoScopes: normalized.linkedRepoScopes,
          crossRepo: normalized.crossRepo,
        },
        normalized.aiContext,
        true
      ),
      schemaVersion: 2,
      entryType: "next_step",
      status: "active",
      sourceType: normalized.sourceType,
      sourceRef: normalized.sourceRef,
      relatedPaths: normalized.relatedPaths,
      moduleKey: normalized.moduleKey,
      stageKey: normalized.stageKey,
      confidence: normalized.confidence,
      isActive: true,
    });
  }

  async writeConfirmedEntry({
    kind,
    ...input
  } = {}) {
    const resolvedKind = safeText(kind);

    switch (resolvedKind) {
      case "section_state":
        return this.upsertSectionState(input);

      case "decision":
        return this.appendDecision(input);

      case "constraint":
        return this.appendConstraint(input);

      case "next_step":
        return this.appendNextStep(input);

      default:
        throw new Error(
          "ProjectMemoryConfirmedWriter.writeConfirmedEntry: unsupported kind"
        );
    }
  }
}

export default ProjectMemoryConfirmedWriter;