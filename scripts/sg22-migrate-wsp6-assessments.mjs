#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const stateDir = process.env.OPENCLAW_STATE_DIR || "/data/.openclaw";
const sgDir = path.join(stateDir, "sg");
const databasePath = path.join(sgDir, "wsp6.sqlite");
const archivePath = path.join(sgDir, "archive", "wsp6-v1.json");
const resourceScopesPath = path.join(sgDir, "workspaces.json");
const pluginEnabled = process.env.SG_WORKSPACE_PLUGIN_ENABLED !== "false";

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const nonEmpty = (value) => typeof value === "string" && Boolean(value.trim());
const checksum = (value) => createHash("sha256").update(value).digest("hex");
const normalizedJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

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

function validScope(scope) {
  if (!isObject(scope)) {
    return false;
  }
  return scope.kind === "personal"
    ? Object.keys(scope).length === 2 && nonEmpty(scope.globalId)
    : scope.kind === "resource" &&
        Object.keys(scope).length === 2 &&
        nonEmpty(scope.resourceScopeId);
}

function legacyRecord(value) {
  return isObject(value) && value.version === 1 && nonEmpty(value.workspaceId) && !value.scope;
}

function migratedRecord(value) {
  return (
    isObject(value) && value.version === 2 && validScope(value.scope) && !("workspaceId" in value)
  );
}

function resourceScopeIds(store) {
  if (
    !isObject(store) ||
    store.version !== 2 ||
    !Array.isArray(store.resourceScopes) ||
    !store.resourceScopes.every((scope) => isObject(scope) && nonEmpty(scope.resourceScopeId))
  ) {
    throw new Error("sg-wsp6-migration-resource-scopes-invalid");
  }
  return new Set(store.resourceScopes.map((scope) => scope.resourceScopeId));
}

function scopeKey(scope) {
  return scope.kind === "personal"
    ? `personal:${scope.globalId}`
    : `resource:${scope.resourceScopeId}`;
}

function definitionKey(value) {
  const digest = checksum(scopeKey(value.scope));
  return `test:${digest}:${value.testId}`;
}

function attemptSlotKey(value) {
  const digest = checksum(`${scopeKey(value.scope)}\0${value.testId}\0${value.globalId}`);
  return `active:${digest}`;
}

function migrateValue(value) {
  if (migratedRecord(value)) {
    return value;
  }
  const { workspaceId, ...rest } = value;
  return {
    ...rest,
    version: 2,
    scope: { kind: "resource", resourceScopeId: workspaceId },
  };
}

function transformedRows(rows) {
  const transformed = rows.map((row) => {
    const value = migrateValue(row.value);
    const key =
      row.namespace === "definitions"
        ? definitionKey(value)
        : row.key.startsWith("history:")
          ? `history:${value.attemptId}`
          : attemptSlotKey(value);
    return { ...row, key, value, value_json: JSON.stringify(value) };
  });
  const keys = transformed.map((row) => `${row.namespace}\0${row.key}`);
  if (new Set(keys).size !== keys.length) {
    throw new Error("sg-wsp6-migration-key-conflict");
  }
  return transformed;
}

async function archiveLegacy(rows) {
  const sourceRows = rows.map(({ namespace, key, value_json, created_at }) => ({
    namespace,
    key,
    value_json,
    created_at,
  }));
  const sourceChecksum = checksum(JSON.stringify(sourceRows));
  const existing = await readOptional(archivePath);
  if (existing !== undefined) {
    const archive = parseJson(existing, "sg-wsp6-migration-archive-invalid");
    if (
      !isObject(archive) ||
      archive.migrationVersion !== 1 ||
      archive.sourceChecksum !== sourceChecksum
    ) {
      throw new Error("sg-wsp6-migration-archive-conflict");
    }
    return;
  }
  await writeAtomically(
    archivePath,
    normalizedJson({
      migrationVersion: 1,
      archivedAt: new Date().toISOString(),
      sourceChecksum,
      sourceRows,
    }),
  );
  const written = parseJson(
    await readFile(archivePath, "utf8"),
    "sg-wsp6-migration-archive-invalid",
  );
  if (!isObject(written) || written.sourceChecksum !== sourceChecksum) {
    throw new Error("sg-wsp6-migration-archive-verification-failed");
  }
}

function readState(database) {
  const table = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sg_wsp6_state'")
    .get();
  if (!table) {
    return [];
  }
  return database
    .prepare(
      "SELECT namespace, key, value_json, created_at FROM sg_wsp6_state WHERE namespace IN ('definitions', 'attempts') ORDER BY namespace, key",
    )
    .all()
    .map((row) => ({
      ...row,
      value: parseJson(row.value_json, "sg-wsp6-migration-state-corrupt"),
    }));
}

function validateRows(rows) {
  for (const row of rows) {
    const value = row.value;
    if (!legacyRecord(value) && !migratedRecord(value)) {
      throw new Error("sg-wsp6-migration-unrecognized-record");
    }
    if (row.namespace === "definitions") {
      if (!nonEmpty(value.testId)) {
        throw new Error("sg-wsp6-migration-unrecognized-record");
      }
    } else if (
      row.namespace !== "attempts" ||
      !nonEmpty(value.attemptId) ||
      !nonEmpty(value.testId) ||
      !nonEmpty(value.globalId)
    ) {
      throw new Error("sg-wsp6-migration-unrecognized-record");
    }
  }
}

function writeRows(database, rows) {
  const insert = database.prepare(
    "INSERT INTO sg_wsp6_state (namespace, key, value_json, created_at) VALUES (?, ?, ?, ?)",
  );
  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare("DELETE FROM sg_wsp6_state WHERE namespace IN ('definitions', 'attempts')")
      .run();
    for (const row of rows) {
      insert.run(row.namespace, row.key, row.value_json, row.created_at);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

async function migrate() {
  if (!pluginEnabled || !(await exists(databasePath))) {
    return;
  }
  const database = new DatabaseSync(databasePath);
  try {
    const rows = readState(database);
    if (rows.length === 0) {
      return;
    }
    validateRows(rows);
    const legacy = rows.filter((row) => legacyRecord(row.value));
    if (legacy.length === 0) {
      return;
    }
    const resourceSource = await readOptional(resourceScopesPath);
    if (resourceSource === undefined) {
      throw new Error("sg-wsp6-migration-resource-scopes-missing");
    }
    const scopeIds = resourceScopeIds(
      parseJson(resourceSource, "sg-wsp6-migration-resource-scopes-invalid"),
    );
    if (legacy.some((row) => !scopeIds.has(row.value.workspaceId))) {
      throw new Error("sg-wsp6-migration-unmapped-scope");
    }
    const migrated = transformedRows(rows);
    validateRows(migrated);
    await archiveLegacy(rows);
    writeRows(database, migrated);
    const written = readState(database);
    validateRows(written);
    if (written.some((row) => legacyRecord(row.value)) || written.length !== migrated.length) {
      throw new Error("sg-wsp6-migration-verification-failed");
    }
  } finally {
    database.close();
  }
}

try {
  await migrate();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
