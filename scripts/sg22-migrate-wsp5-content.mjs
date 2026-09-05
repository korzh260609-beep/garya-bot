#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const stateDir = process.env.OPENCLAW_STATE_DIR || "/data/.openclaw";
const sgDir = path.join(stateDir, "sg");
const contentPath = path.join(sgDir, "content.json");
const archivePath = path.join(sgDir, "archive", "content-v1.json");
const resourceScopesPath = path.join(sgDir, "workspaces.json");
const pluginEnabled = process.env.SG_WORKSPACE_PLUGIN_ENABLED !== "false";

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const nonEmpty = (value) => typeof value === "string" && Boolean(value.trim());
const checksum = (value) => createHash("sha256").update(value).digest("hex");
const normalizedJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

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

function parseJson(source, errorCode) {
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(errorCode);
  }
}

function legacyRecords(store) {
  if (
    !isObject(store) ||
    store.version !== 1 ||
    !Array.isArray(store.drafts) ||
    !Array.isArray(store.publications) ||
    !Array.isArray(store.audit)
  ) {
    throw new Error("sg-wsp5-content-migration-unrecognized-store");
  }
  const records = [...store.drafts, ...store.publications, ...store.audit];
  if (!records.every((record) => isObject(record) && nonEmpty(record.workspaceId))) {
    throw new Error("sg-wsp5-content-migration-unrecognized-store");
  }
  return records;
}

function resourceScopeIds(store) {
  if (
    !isObject(store) ||
    store.version !== 2 ||
    !Array.isArray(store.resourceScopes) ||
    !store.resourceScopes.every((scope) => isObject(scope) && nonEmpty(scope.resourceScopeId))
  ) {
    throw new Error("sg-wsp5-content-migration-resource-scopes-invalid");
  }
  return new Set(store.resourceScopes.map((scope) => scope.resourceScopeId));
}

function migratedRecord(record) {
  const { workspaceId, ...rest } = record;
  return {
    ...rest,
    scope: { kind: "resource", resourceScopeId: workspaceId },
  };
}

function validMigratedStore(store) {
  if (
    !isObject(store) ||
    store.version !== 2 ||
    !Array.isArray(store.drafts) ||
    !Array.isArray(store.publications) ||
    !Array.isArray(store.audit)
  ) {
    return false;
  }
  return [...store.drafts, ...store.publications, ...store.audit].every((record) => {
    if (!isObject(record) || !isObject(record.scope) || "workspaceId" in record) {
      return false;
    }
    return record.scope.kind === "personal"
      ? nonEmpty(record.scope.globalId)
      : record.scope.kind === "resource" && nonEmpty(record.scope.resourceScopeId);
  });
}

async function archiveLegacy(source, store) {
  const sourceChecksum = checksum(source);
  const existing = await readOptional(archivePath);
  if (existing !== undefined) {
    const archive = parseJson(existing, "sg-wsp5-content-migration-archive-invalid");
    if (
      !isObject(archive) ||
      archive.migrationVersion !== 1 ||
      archive.sourceStoreVersion !== 1 ||
      archive.sourceChecksum !== sourceChecksum
    ) {
      throw new Error("sg-wsp5-content-migration-archive-conflict");
    }
    return;
  }
  const archive = {
    migrationVersion: 1,
    archivedAt: new Date().toISOString(),
    sourceStoreVersion: 1,
    sourceChecksum,
    drafts: store.drafts,
    publications: store.publications,
    audit: store.audit,
  };
  await writeAtomically(archivePath, normalizedJson(archive));
  const written = parseJson(
    await readFile(archivePath, "utf8"),
    "sg-wsp5-content-migration-archive-invalid",
  );
  if (!isObject(written) || written.sourceChecksum !== sourceChecksum) {
    throw new Error("sg-wsp5-content-migration-archive-verification-failed");
  }
}

async function migrate() {
  if (!pluginEnabled) {
    return;
  }
  const source = await readOptional(contentPath);
  if (source === undefined) {
    return;
  }
  const store = parseJson(source, "sg-wsp5-content-migration-unrecognized-store");
  if (validMigratedStore(store)) {
    return;
  }
  const records = legacyRecords(store);
  const resourceSource = await readOptional(resourceScopesPath);
  if (resourceSource === undefined) {
    throw new Error("sg-wsp5-content-migration-resource-scopes-missing");
  }
  const scopeIds = resourceScopeIds(
    parseJson(resourceSource, "sg-wsp5-content-migration-resource-scopes-invalid"),
  );
  if (records.some((record) => !scopeIds.has(record.workspaceId))) {
    throw new Error("sg-wsp5-content-migration-unmapped-scope");
  }
  const migrated = {
    version: 2,
    drafts: store.drafts.map(migratedRecord),
    publications: store.publications.map(migratedRecord),
    audit: store.audit.map(migratedRecord),
  };
  if (!validMigratedStore(migrated)) {
    throw new Error("sg-wsp5-content-migration-result-invalid");
  }
  await archiveLegacy(source, store);
  await writeAtomically(contentPath, normalizedJson(migrated));
  const written = parseJson(
    await readFile(contentPath, "utf8"),
    "sg-wsp5-content-migration-verification-failed",
  );
  if (!validMigratedStore(written)) {
    throw new Error("sg-wsp5-content-migration-verification-failed");
  }
}

try {
  await migrate();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
