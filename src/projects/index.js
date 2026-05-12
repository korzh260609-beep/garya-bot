// src/projects/index.js
// SG 2.0 — Projects Public Boundary.
//
// Purpose:
// - Provide one stable import surface for project registry modules.
// - Keep project registry separate from memory, AI, Telegram, billing, and sources.
//
// Hard rules:
// - Do not add DB queries directly here.
// - Do not add Project Memory writes here.
// - Do not add Telegram or transport logic here.
// - Do not add AI provider/model calls here.
// - Do not turn this file into a projects monolith.

export {
  USER_PROJECTS_REGISTRY_VERSION,
  USER_PROJECT_STATUSES,
  USER_PROJECT_VISIBILITY,
  USER_PROJECT_DEFAULT_STATUS,
  USER_PROJECT_DEFAULT_VISIBILITY,
  normalizeUserProjectText,
  normalizeUserProjectKeyPart,
  normalizeUserProjectStatus,
  normalizeUserProjectVisibility,
  createUserProjectRecord,
  validateUserProjectRecord,
} from "./userProjectsTypes.js";

export {
  USER_PROJECTS_SCHEMA_VERSION,
  USER_PROJECTS_TABLES,
  getUserProjectsSchemaSql,
  createUserProjectsSchema,
  ensureUserProjectsSchema,
} from "./userProjectsSchema.js";

export { UserProjectsStore } from "./userProjectsStore.js";

export function getProjectsModuleStatus() {
  return {
    ok: true,
    module: "projects",
    status: "public_boundary_ready",
    runtimeConnected: false,
    hasDbSchemaBoundary: true,
    hasStoreBoundary: true,
    hasProjectMemoryWrites: false,
    hasProjectMemoryConfirmation: false,
    hasTransportLogic: false,
    hasAICalls: false,
    hasSourceFetching: false,
    principles: {
      transportIndependent: true,
      telegramIsDeliveryOnly: true,
      ownershipMustBeExplicit: true,
      oneUserMayOwnManyProjects: true,
      userProjectsDoNotShareMemoryByDefault: true,
      projectMemoryAutoWriteDisabled: true,
    },
  };
}

export default {
  getProjectsModuleStatus,
};
