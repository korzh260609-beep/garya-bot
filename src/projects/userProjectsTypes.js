// src/projects/userProjectsTypes.js
// SG 2.0 — User Projects Registry types.
//
// Purpose:
// - Define deterministic user project records.
// - Keep project ownership explicit and transport-independent.
//
// Hard rules:
// - Do not write Project Memory here.
// - Do not read Project Memory here.
// - Do not call AI here.
// - Do not touch Telegram or transport logic here.
// - Do not infer project ownership from natural-language phrases.

export const USER_PROJECTS_REGISTRY_VERSION = 1;

export const USER_PROJECT_STATUSES = Object.freeze({
  ACTIVE: "active",
  ARCHIVED: "archived",
  SUSPENDED: "suspended",
  DELETED: "deleted",
});

export const USER_PROJECT_VISIBILITY = Object.freeze({
  PRIVATE: "private",
  SHARED: "shared",
  PUBLIC_READONLY: "public_readonly",
});

export const USER_PROJECT_DEFAULT_STATUS = USER_PROJECT_STATUSES.ACTIVE;
export const USER_PROJECT_DEFAULT_VISIBILITY = USER_PROJECT_VISIBILITY.PRIVATE;

const ALLOWED_STATUSES = new Set(Object.values(USER_PROJECT_STATUSES));
const ALLOWED_VISIBILITY = new Set(Object.values(USER_PROJECT_VISIBILITY));

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

export function normalizeUserProjectText(value) {
  return safeString(value).trim();
}

export function normalizeUserProjectKeyPart(value) {
  return normalizeUserProjectText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeUserProjectStatus(value) {
  const status = normalizeUserProjectText(value).toLowerCase();
  return ALLOWED_STATUSES.has(status) ? status : USER_PROJECT_DEFAULT_STATUS;
}

export function normalizeUserProjectVisibility(value) {
  const visibility = normalizeUserProjectText(value).toLowerCase();
  return ALLOWED_VISIBILITY.has(visibility) ? visibility : USER_PROJECT_DEFAULT_VISIBILITY;
}

export function createUserProjectRecord({
  id = "",
  ownerGlobalUserId = "",
  title = "",
  slug = "",
  status = USER_PROJECT_DEFAULT_STATUS,
  visibility = USER_PROJECT_DEFAULT_VISIBILITY,
  metadata = {},
  createdAt = null,
  updatedAt = null,
} = {}) {
  const safeOwnerGlobalUserId = normalizeUserProjectKeyPart(ownerGlobalUserId);
  const safeId = normalizeUserProjectKeyPart(id || slug || title);
  const safeTitle = normalizeUserProjectText(title) || safeId;
  const safeSlug = normalizeUserProjectKeyPart(slug || safeTitle || safeId);

  return {
    id: safeId,
    ownerGlobalUserId: safeOwnerGlobalUserId,
    title: safeTitle,
    slug: safeSlug,
    status: normalizeUserProjectStatus(status),
    visibility: normalizeUserProjectVisibility(visibility),
    metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {},
    createdAt,
    updatedAt,
  };
}

export function validateUserProjectRecord(record = {}) {
  const errors = [];

  if (!record.id) errors.push("missing_project_id");
  if (!record.ownerGlobalUserId) errors.push("missing_owner_global_user_id");
  if (!record.title) errors.push("missing_project_title");
  if (!ALLOWED_STATUSES.has(record.status)) errors.push("invalid_project_status");
  if (!ALLOWED_VISIBILITY.has(record.visibility)) errors.push("invalid_project_visibility");

  return {
    ok: errors.length === 0,
    errors,
  };
}

export default {
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
};
