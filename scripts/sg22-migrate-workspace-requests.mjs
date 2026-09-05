#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MIGRATION_VERSION = 1;
const stateDir = process.env.OPENCLAW_STATE_DIR || "/data/.openclaw";
const sgDir = path.join(stateDir, "sg");
const requestStorePath = path.join(sgDir, "workspace-requests.json");
const requestArchivePath = path.join(sgDir, "archive", "workspace-requests-v1.json");
const workspaceStorePath = path.join(sgDir, "workspaces.json");
const workspaceArchivePath = path.join(sgDir, "archive", "workspaces-v1.json");
const pluginEnabled = process.env.SG_WORKSPACE_PLUGIN_ENABLED !== "false";

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const nonEmpty = (value) => typeof value === "string" && Boolean(value.trim());
const timestamp = (value) => nonEmpty(value) && !Number.isNaN(Date.parse(value));
const checksum = (value) => createHash("sha256").update(value).digest("hex");
const normalizedJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const resourceKinds = new Set(["group", "channel", "room", "topic"]);

async function readOptional(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function writeAtomically(filePath, text) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.migrate-${process.pid}.tmp`;
  await writeFile(temporaryPath, text, { mode: 0o600 });
  await rename(temporaryPath, filePath);
}

function onlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function resourceKey(value) {
  return JSON.stringify([
    value.platform.trim().toLowerCase(),
    value.accountId?.trim() || "default",
    value.resourceId.trim(),
    value.topicId?.trim() || null,
  ]);
}

function validResource(value) {
  return (
    nonEmpty(value.platform) &&
    (value.accountId === undefined || nonEmpty(value.accountId)) &&
    nonEmpty(value.resourceId) &&
    (value.topicId === undefined || nonEmpty(value.topicId))
  );
}

function validRequest(value) {
  return (
    isObject(value) &&
    onlyKeys(value, [
      "requestId",
      "platform",
      "accountId",
      "resourceId",
      "topicId",
      "resourceKind",
      "title",
      "initiatorCanonicalIdentity",
      "initiatorGlobalId",
      "ownerGlobalId",
      "status",
      "authoritySource",
      "decidedByGlobalId",
      "createdAt",
      "updatedAt",
    ]) &&
    nonEmpty(value.requestId) &&
    validResource(value) &&
    resourceKinds.has(value.resourceKind) &&
    nonEmpty(value.title) &&
    nonEmpty(value.initiatorCanonicalIdentity) &&
    (value.initiatorGlobalId === undefined || nonEmpty(value.initiatorGlobalId)) &&
    (value.ownerGlobalId === undefined || nonEmpty(value.ownerGlobalId)) &&
    ["pending", "approved", "rejected"].includes(value.status) &&
    (value.authoritySource === undefined || value.authoritySource === "monarch_confirmation") &&
    (value.decidedByGlobalId === undefined || nonEmpty(value.decidedByGlobalId)) &&
    timestamp(value.createdAt) &&
    timestamp(value.updatedAt)
  );
}

function validRequestStore(value) {
  if (
    !isObject(value) ||
    !onlyKeys(value, ["version", "requests"]) ||
    value.version !== 1 ||
    !Array.isArray(value.requests) ||
    !value.requests.every(validRequest)
  ) {
    return false;
  }
  const requestIds = value.requests.map((request) => request.requestId);
  const resourceKeys = value.requests.map(resourceKey);
  return (
    new Set(requestIds).size === requestIds.length &&
    new Set(resourceKeys).size === resourceKeys.length
  );
}

function validLegacyWorkspace(value) {
  return (
    isObject(value) &&
    onlyKeys(value, [
      "workspaceId",
      "platform",
      "accountId",
      "resourceId",
      "topicId",
      "resourceKind",
      "parentResourceId",
      "title",
      "ownerGlobalId",
      "status",
      "settings",
      "createdAt",
      "updatedAt",
    ]) &&
    nonEmpty(value.workspaceId) &&
    validResource(value) &&
    resourceKinds.has(value.resourceKind) &&
    (value.parentResourceId === undefined || nonEmpty(value.parentResourceId)) &&
    nonEmpty(value.title) &&
    nonEmpty(value.ownerGlobalId) &&
    ["pending", "active", "suspended", "archived"].includes(value.status) &&
    isObject(value.settings) &&
    timestamp(value.createdAt) &&
    timestamp(value.updatedAt)
  );
}

function validLegacyWorkspaceStore(value) {
  if (
    !isObject(value) ||
    !onlyKeys(value, ["version", "workspaces"]) ||
    value.version !== 1 ||
    !Array.isArray(value.workspaces) ||
    !value.workspaces.every(validLegacyWorkspace)
  ) {
    return false;
  }
  const workspaceIds = value.workspaces.map((workspace) => workspace.workspaceId);
  const resourceKeys = value.workspaces.map(resourceKey);
  return (
    new Set(workspaceIds).size === workspaceIds.length &&
    new Set(resourceKeys).size === resourceKeys.length
  );
}

function validResourceScope(value) {
  return (
    isObject(value) &&
    onlyKeys(value, [
      "resourceScopeId",
      "platform",
      "accountId",
      "resourceId",
      "topicId",
      "resourceKind",
      "parentResourceId",
      "createdAt",
      "updatedAt",
    ]) &&
    nonEmpty(value.resourceScopeId) &&
    validResource(value) &&
    resourceKinds.has(value.resourceKind) &&
    (value.parentResourceId === undefined || nonEmpty(value.parentResourceId)) &&
    timestamp(value.createdAt) &&
    timestamp(value.updatedAt)
  );
}

function validResourceScopeStore(value) {
  if (
    !isObject(value) ||
    !onlyKeys(value, ["version", "resourceScopes"]) ||
    value.version !== 2 ||
    !Array.isArray(value.resourceScopes) ||
    !value.resourceScopes.every(validResourceScope)
  ) {
    return false;
  }
  const scopeIds = value.resourceScopes.map((scope) => scope.resourceScopeId);
  const resourceKeys = value.resourceScopes.map(resourceKey);
  return (
    new Set(scopeIds).size === scopeIds.length && new Set(resourceKeys).size === resourceKeys.length
  );
}

function legacyRecordsChecksum(records) {
  return checksum(JSON.stringify(records));
}

function validArchive(value, recordKey, validateStore) {
  return (
    isObject(value) &&
    value.migrationVersion === MIGRATION_VERSION &&
    value.sourceStoreVersion === 1 &&
    timestamp(value.archivedAt) &&
    /^[a-f0-9]{64}$/u.test(value.sourceChecksum) &&
    /^[a-f0-9]{64}$/u.test(value.legacyRecordsChecksum) &&
    validateStore({ version: 1, [recordKey]: value[recordKey] }) &&
    value.legacyRecordsChecksum === legacyRecordsChecksum({ [recordKey]: value[recordKey] })
  );
}

async function archiveLegacyStore({ source, archivePath, recordKey, validateStore, invalidError }) {
  const archived = await readOptional(archivePath);
  if (source === undefined) {
    if (archived === undefined) {
      return undefined;
    }
    let archive;
    try {
      archive = JSON.parse(archived);
    } catch {
      throw new Error(`${invalidError}-archive-invalid`);
    }
    if (!validArchive(archive, recordKey, validateStore)) {
      throw new Error(`${invalidError}-archive-invalid`);
    }
    return undefined;
  }

  let store;
  try {
    store = JSON.parse(source);
  } catch {
    throw new Error(`${invalidError}-unrecognized-store`);
  }
  if (!validateStore(store)) {
    throw new Error(`${invalidError}-unrecognized-store`);
  }
  const sourceChecksum = checksum(source);
  const recordsChecksum = legacyRecordsChecksum({ [recordKey]: store[recordKey] });
  if (archived !== undefined) {
    let archive;
    try {
      archive = JSON.parse(archived);
    } catch {
      throw new Error(`${invalidError}-archive-invalid`);
    }
    if (
      !validArchive(archive, recordKey, validateStore) ||
      archive.sourceChecksum !== sourceChecksum ||
      archive.legacyRecordsChecksum !== recordsChecksum
    ) {
      throw new Error(`${invalidError}-archive-conflict`);
    }
    return store;
  }
  const archive = {
    migrationVersion: MIGRATION_VERSION,
    archivedAt: new Date().toISOString(),
    sourceStoreVersion: 1,
    sourceChecksum,
    legacyRecordsChecksum: recordsChecksum,
    [recordKey]: store[recordKey],
  };
  await writeAtomically(archivePath, normalizedJson(archive));
  const writtenArchive = JSON.parse(await readFile(archivePath, "utf8"));
  if (
    !validArchive(writtenArchive, recordKey, validateStore) ||
    writtenArchive.sourceChecksum !== sourceChecksum
  ) {
    throw new Error(`${invalidError}-archive-verification-failed`);
  }
  return store;
}

async function migrateWorkspaces() {
  const source = await readOptional(workspaceStorePath);
  if (source === undefined) {
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("sg-resource-scope-migration-unrecognized-store");
  }
  if (validResourceScopeStore(parsed)) {
    return;
  }
  const legacy = await archiveLegacyStore({
    source,
    archivePath: workspaceArchivePath,
    recordKey: "workspaces",
    validateStore: validLegacyWorkspaceStore,
    invalidError: "sg-resource-scope-migration",
  });
  const resourceScopes = legacy.workspaces.map((workspace) => {
    const scope = {
      resourceScopeId: workspace.workspaceId,
      platform: workspace.platform.trim().toLowerCase(),
      resourceId: workspace.resourceId.trim(),
      resourceKind: workspace.resourceKind,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
    if (workspace.accountId) {
      scope.accountId = workspace.accountId.trim();
    }
    if (workspace.parentResourceId) {
      scope.parentResourceId = workspace.parentResourceId.trim();
    }
    if (workspace.topicId) {
      scope.topicId = workspace.topicId.trim();
    }
    return scope;
  });
  const migrated = { version: 2, resourceScopes };
  if (!validResourceScopeStore(migrated)) {
    throw new Error("sg-resource-scope-migration-result-invalid");
  }
  await writeAtomically(workspaceStorePath, normalizedJson(migrated));
  if (!validResourceScopeStore(JSON.parse(await readFile(workspaceStorePath, "utf8")))) {
    throw new Error("sg-resource-scope-migration-verification-failed");
  }
}

async function migrateRequests() {
  const source = await readOptional(requestStorePath);
  await archiveLegacyStore({
    source,
    archivePath: requestArchivePath,
    recordKey: "requests",
    validateStore: validRequestStore,
    invalidError: "sg-workspace-request-migration",
  });
  if (source !== undefined) {
    await unlink(requestStorePath);
  }
}

async function migrate() {
  if (!pluginEnabled) {
    return;
  }
  await migrateWorkspaces();
  await migrateRequests();
}

try {
  await migrate();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
