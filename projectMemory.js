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

const service = new ProjectMemoryService({
  dbPool: pool,
  defaultProjectKey: DEFAULT_PROJECT_KEY,
});

const contextBuilder = new ProjectMemoryContextBuilder({ service });
const sourceSync = new ProjectMemorySourceSync({ service });
const sessionRecorder = new ProjectMemorySessionRecorder({ service });

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

export async function buildProjectMemoryContext(input = {}) {
  return contextBuilder.buildSoftContext(input);
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

export {
  service as projectMemoryService,
  contextBuilder as projectMemoryContextBuilder,
  sourceSync as projectMemorySourceSync,
  sessionRecorder as projectMemorySessionRecorder,
  DEFAULT_PROJECT_KEY,
};

export default {
  getProjectSection,
  getProjectMemoryList,
  upsertProjectSection,
  appendProjectMemoryEntry,
  archiveProjectMemoryEntries,
  buildProjectMemoryContext,
  buildProjectMemoryDigest,
  syncProjectMemorySources,
  recordProjectWorkSession,
  projectMemoryService: service,
  projectMemoryContextBuilder: contextBuilder,
  projectMemorySourceSync: sourceSync,
  projectMemorySessionRecorder: sessionRecorder,
  DEFAULT_PROJECT_KEY,
};