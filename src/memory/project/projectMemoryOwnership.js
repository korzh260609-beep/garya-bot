// src/memory/project/projectMemoryOwnership.js
// SG 2.0 — Project Memory ownership and multi-project scope boundary.
//
// Purpose:
// - Separate SG project memory from user project memory.
// - Support many user projects per user without mixing memory.
// - Provide deterministic project keys and read guards.
//
// Hard rules:
// - Do not write memory here.
// - Do not read DB here.
// - Do not call AI here.
// - Do not touch Telegram or transport logic here.
// - Do not infer ownership from natural-language phrases.

export const PROJECT_MEMORY_OWNERSHIP_VERSION = 1;

export const PROJECT_MEMORY_OWNER_TYPES = Object.freeze({
  SG_PROJECT: "sg_project",
  USER_PROJECT: "user_project",
});

export const PROJECT_MEMORY_VISIBILITY = Object.freeze({
  SYSTEM_INTERNAL: "system_internal",
  PRIVATE_USER_PROJECT: "private_user_project",
  SHARED_USER_PROJECT: "shared_user_project",
});

export const SG_PROJECT_MEMORY_KEY = "sg";

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeString(value).trim();
}

function normalizeKeyPart(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildSgProjectMemoryRef() {
  return {
    ok: true,
    ownerType: PROJECT_MEMORY_OWNER_TYPES.SG_PROJECT,
    ownerRef: "sg",
    projectKey: SG_PROJECT_MEMORY_KEY,
    visibility: PROJECT_MEMORY_VISIBILITY.SYSTEM_INTERNAL,
  };
}

export function buildUserProjectMemoryKey({ globalUserId = "", userProjectId = "" } = {}) {
  const safeGlobalUserId = normalizeKeyPart(globalUserId);
  const safeUserProjectId = normalizeKeyPart(userProjectId);

  if (!safeGlobalUserId || !safeUserProjectId) {
    return {
      ok: false,
      reason: "missing_global_user_id_or_user_project_id",
      projectKey: "",
    };
  }

  return {
    ok: true,
    projectKey: `user_project:${safeGlobalUserId}:${safeUserProjectId}`,
  };
}

export function buildUserProjectMemoryRef({
  globalUserId = "",
  userProjectId = "",
  visibility = PROJECT_MEMORY_VISIBILITY.PRIVATE_USER_PROJECT,
} = {}) {
  const ownerRef = normalizeKeyPart(globalUserId);
  const safeUserProjectId = normalizeKeyPart(userProjectId);
  const key = buildUserProjectMemoryKey({ globalUserId, userProjectId });

  if (!key.ok) {
    return {
      ok: false,
      reason: key.reason,
      ownerType: PROJECT_MEMORY_OWNER_TYPES.USER_PROJECT,
      ownerRef,
      userProjectId: safeUserProjectId,
      projectKey: "",
      visibility,
    };
  }

  return {
    ok: true,
    ownerType: PROJECT_MEMORY_OWNER_TYPES.USER_PROJECT,
    ownerRef,
    userProjectId: safeUserProjectId,
    projectKey: key.projectKey,
    visibility,
  };
}

export function parseProjectMemoryKey(projectKey = "") {
  const key = normalizeText(projectKey);

  if (key === SG_PROJECT_MEMORY_KEY) {
    return buildSgProjectMemoryRef();
  }

  const parts = key.split(":");
  if (parts.length === 3 && parts[0] === "user_project" && parts[1] && parts[2]) {
    return {
      ok: true,
      ownerType: PROJECT_MEMORY_OWNER_TYPES.USER_PROJECT,
      ownerRef: parts[1],
      userProjectId: parts[2],
      projectKey: key,
      visibility: PROJECT_MEMORY_VISIBILITY.PRIVATE_USER_PROJECT,
    };
  }

  return {
    ok: false,
    reason: "unknown_project_memory_key_format",
    ownerType: null,
    ownerRef: "",
    userProjectId: "",
    projectKey: key,
    visibility: null,
  };
}

export function canReadProjectMemory({ actor = {}, projectRef = {} } = {}) {
  if (!projectRef?.ok) {
    return {
      ok: false,
      allowed: false,
      reason: projectRef?.reason || "invalid_project_memory_ref",
    };
  }

  if (projectRef.ownerType === PROJECT_MEMORY_OWNER_TYPES.SG_PROJECT) {
    return {
      ok: true,
      allowed: Boolean(actor?.isMonarch || actor?.role === "system"),
      reason: actor?.isMonarch || actor?.role === "system" ? null : "sg_project_memory_requires_monarch_or_system",
    };
  }

  if (projectRef.ownerType === PROJECT_MEMORY_OWNER_TYPES.USER_PROJECT) {
    const actorGlobalUserId = normalizeKeyPart(actor?.globalUserId);
    const ownerRef = normalizeKeyPart(projectRef.ownerRef);
    const allowed = Boolean(actor?.isMonarch || actorGlobalUserId === ownerRef);

    return {
      ok: true,
      allowed,
      reason: allowed ? null : "user_project_memory_owner_mismatch",
    };
  }

  return {
    ok: false,
    allowed: false,
    reason: "unknown_project_memory_owner_type",
  };
}

export function canWriteProjectMemoryCandidate(input = {}) {
  return canReadProjectMemory(input);
}

export default {
  PROJECT_MEMORY_OWNERSHIP_VERSION,
  PROJECT_MEMORY_OWNER_TYPES,
  PROJECT_MEMORY_VISIBILITY,
  SG_PROJECT_MEMORY_KEY,
  buildSgProjectMemoryRef,
  buildUserProjectMemoryKey,
  buildUserProjectMemoryRef,
  parseProjectMemoryKey,
  canReadProjectMemory,
  canWriteProjectMemoryCandidate,
};
