// projectMemory.js
// ============================================================================
// Backward-compatible facade for Project Memory
// Purpose:
// - keep old imports working
// - route all project memory access through ProjectMemoryService
// - prepare universal project memory logic for multiple transports / UI
// ============================================================================

import pool from "./db.js";
import { ProjectMemoryService, DEFAULT_PROJECT_KEY } from "./src/projectMemory/ProjectMemoryService.js";
import { ProjectMemoryContextBuilder } from "./src/projectMemory/ProjectMemoryContextBuilder.js";
import { ProjectMemorySourceSync } from "./src/projectMemory/ProjectMemorySourceSync.js";
import { ProjectMemorySessionRecorder } from "./src/projectMemory/ProjectMemorySessionRecorder.js";
import { ProjectMemorySessionUpdater } from "./src/projectMemory/ProjectMemorySessionUpdater.js";
import { ProjectMemoryConfirmedWriter } from "./src/projectMemory/ProjectMemoryConfirmedWriter.js";
import { ProjectMemoryConfirmedReader } from "./src/projectMemory/ProjectMemoryConfirmedReader.js";

const service = new ProjectMemoryService({
  dbPool: pool,
  defaultProjectKey: DEFAULT_PROJECT_KEY,
});

const contextBuilder = new ProjectMemoryContextBuilder({ service });
const sourceSync = new ProjectMemorySourceSync({ service });
const sessionRecorder = new ProjectMemorySessionRecorder({ service });
const sessionUpdater = new ProjectMemorySessionUpdater({ service });
const confirmedWriter = new ProjectMemoryConfirmedWriter({ service });
const confirmedReader = new ProjectMemoryConfirmedReader({ service });

// ============================================================================
// Backward-compatible API
// ============================================================================

export async function getProjectSection(
  projectKey = DEFAULT_PROJECT_KEY,
  section
) {
  return service.getLatestSection(projectKey, section);
}

export async function getProjectMemoryList(
  projectKey = DEFAULT_PROJECT_KEY,
  section = null
) {
  return service.listSections(projectKey, section);
}

export async function upsertProjectSection({
  projectKey = DEFAULT_PROJECT_KEY,
  section,
  title = null,
  content,
  tags = [],
  meta = {},
  schemaVersion = 1,
}) {
  return service.upsertSectionState({
    projectKey,
    section,
    title,
    content,
    tags,
    meta,
    schemaVersion,
    entryType: "section_state",
    status: "active",
    sourceType: "manual",
    sourceRef: null,
    relatedPaths: [],
    moduleKey: "project_memory",
    stageKey: "7A",
    confidence: 0.9,
    isActive: true,
  });
}

// ============================================================================
// V2 API
// ============================================================================

export async function appendProjectMemoryEntry(input = {}) {
  return service.appendEntry(input);
}

export async function archiveProjectMemoryEntries(input = {}) {
  return service.archiveActiveEntries(input);
}

export async function buildConfirmedProjectMemoryContext(input = {}) {
  return contextBuilder.buildConfirmedContext(input);
}

export async function buildProjectMemoryContext(input = {}) {
  return contextBuilder.buildConfirmedContext(input);
}

export async function buildProjectMemoryDigest(input = {}) {
  return contextBuilder.buildProjectDigest(input);
}

export async function syncProjectMemorySources(input = {}) {
  return sourceSync.syncCanonicalSections(input);
}

export async function recordProjectWorkSession(input = {}) {
  return sessionRecorder.recordSession(input);
}

export async function updateProjectWorkSession(input = {}) {
  return sessionUpdater.updateSession(input);
}

// ============================================================================
// Confirmed project memory write API (transport-agnostic)
// ============================================================================

export async function upsertConfirmedProjectSectionState(input = {}) {
  return confirmedWriter.upsertSectionState(input);
}

export async function appendConfirmedProjectDecision(input = {}) {
  return confirmedWriter.appendDecision(input);
}

export async function appendConfirmedProjectConstraint(input = {}) {
  return confirmedWriter.appendConstraint(input);
}

export async function appendConfirmedProjectNextStep(input = {}) {
  return confirmedWriter.appendNextStep(input);
}

export async function writeConfirmedProjectMemory(input = {}) {
  return confirmedWriter.writeConfirmedEntry(input);
}

// ============================================================================
// Confirmed project memory read API (transport-agnostic)
// ============================================================================

export async function listConfirmedProjectMemoryEntries(input = {}) {
  return confirmedReader.listEntries(input);
}

export async function getLatestConfirmedProjectMemoryEntry(input = {}) {
  return confirmedReader.getLatestEntry(input);
}

export async function buildConfirmedProjectMemoryDigest(input = {}) {
  return confirmedReader.buildDigest(input);
}

export {
  service as projectMemoryService,
  contextBuilder as projectMemoryContextBuilder,
  sourceSync as projectMemorySourceSync,
  sessionRecorder as projectMemorySessionRecorder,
  sessionUpdater as projectMemorySessionUpdater,
  confirmedWriter as projectMemoryConfirmedWriter,
  confirmedReader as projectMemoryConfirmedReader,
  DEFAULT_PROJECT_KEY,
};

export default {
  getProjectSection,
  getProjectMemoryList,
  upsertProjectSection,
  appendProjectMemoryEntry,
  archiveProjectMemoryEntries,
  buildConfirmedProjectMemoryContext,
  buildProjectMemoryContext,
  buildProjectMemoryDigest,
  syncProjectMemorySources,
  recordProjectWorkSession,
  updateProjectWorkSession,

  upsertConfirmedProjectSectionState,
  appendConfirmedProjectDecision,
  appendConfirmedProjectConstraint,
  appendConfirmedProjectNextStep,
  writeConfirmedProjectMemory,

  listConfirmedProjectMemoryEntries,
  getLatestConfirmedProjectMemoryEntry,
  buildConfirmedProjectMemoryDigest,

  projectMemoryService: service,
  projectMemoryContextBuilder: contextBuilder,
  projectMemorySourceSync: sourceSync,
  projectMemorySessionRecorder: sessionRecorder,
  projectMemorySessionUpdater: sessionUpdater,
  projectMemoryConfirmedWriter: confirmedWriter,
  projectMemoryConfirmedReader: confirmedReader,
  DEFAULT_PROJECT_KEY,
};
